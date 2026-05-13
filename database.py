import os
import uuid
import io
import random
import time
import smtplib
import bcrypt
import threading
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_file
from flask_socketio import SocketIO, emit
from flask_jwt_extended import JWTManager, create_access_token
from supabase import create_client, Client
from flask_cors import CORS

# ReportLab imports for PDF generation
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
from reportlab.platypus import KeepTogether
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

# ==========================================
# 1. SETUP ENVIRONMENT & DATABASE
# ==========================================
load_dotenv(override=True)
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
service_key: str = os.environ.get("SUPABASE_SERVICE_KEY", key)  # falls back to anon key if not set
supabase: Client = create_client(url, key)
supabase_admin: Client = create_client(url, service_key)  # bypasses RLS for DELETE/sensitive ops

# ==========================================
# 2. SETUP FLASK, CORS, SOCKET.IO & JWT
# ==========================================
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*")

app.config["SECRET_KEY"]               = os.environ.get("FLASK_KEY",      "fallback-flask-secret")
app.config["JWT_SECRET_KEY"]           = os.environ.get("JWT_SECRET_KEY", "fallback-jwt-secret")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=8)
jwt = JWTManager(app)

# OTP & Reset stores — plain Python dicts acting as temporary in-memory tables
otp_store    = {}  # { token: { otp, email, expires_at } }
reset_store  = {}  # { token: { email, expires_at } }
otp_lock     = threading.Lock()

# Brute-force protection — tracks failed login attempts per IP
login_attempts = {}   # { ip: { count, locked_until } }
MAX_ATTEMPTS   = 5    # lock after 5 failed attempts
LOCKOUT_SECS   = 300  # 5 minute lockout

# Email config from .env
EMAIL_SENDER    = os.environ.get("EMAIL_SENDER",           "")
EMAIL_PASSWORD  = os.environ.get("EMAIL_PASSWORD",         "")
EMAIL_RECIPIENT = os.environ.get("EMAIL_REPORT_RECIPIENT", EMAIL_SENDER)


def send_email(to_addr: str, subject: str, html_body: str, text_body: str = "") -> bool:
    """Send HTML email via Gmail SMTP SSL. Returns True on success."""
    if not EMAIL_SENDER or not EMAIL_PASSWORD:
        print("[EMAIL] Skipped — EMAIL_SENDER / EMAIL_PASSWORD not set in .env")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = EMAIL_SENDER
        msg["To"]      = to_addr
        if text_body:
            msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(EMAIL_SENDER, EMAIL_PASSWORD)
            server.sendmail(EMAIL_SENDER, to_addr, msg.as_string())
        print(f"[EMAIL] Sent '{subject}' to {to_addr}")
        return True
    except Exception as e:
        print(f"[EMAIL ERROR] {e}")
        return False


@app.after_request
def after_request(response):
    response.headers["Access-Control-Allow-Origin"]  = "*"
    response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
    response.headers.add("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS")
    return response


# ==========================================
# 3. [API] LOGIN — returns JWT token
# ==========================================
def _hash_password(plain: str) -> str:
    """Hash a plain-text password with bcrypt."""
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def _check_password(plain: str, hashed: str) -> bool:
    """Verify a plain-text password against a bcrypt hash.
       Also accepts legacy plain-text passwords so existing accounts keep working."""
    try:
        # Modern path — bcrypt hash
        if hashed.startswith("$2b$") or hashed.startswith("$2a$"):
            return bcrypt.checkpw(plain.encode(), hashed.encode())
        # Legacy path — plain text stored before migration
        return plain == hashed
    except Exception:
        return False


def _get_client_ip() -> str:
    return request.headers.get("X-Forwarded-For", request.remote_addr or "unknown").split(",")[0].strip()


def _is_rate_limited(ip: str) -> tuple[bool, int]:
    """Returns (is_locked, seconds_remaining)."""
    now    = time.time()
    entry  = login_attempts.get(ip)
    if not entry:
        return False, 0
    if entry.get("locked_until") and now < entry["locked_until"]:
        return True, int(entry["locked_until"] - now)
    if entry.get("locked_until") and now >= entry["locked_until"]:
        del login_attempts[ip]  # lockout expired — reset
    return False, 0


def _record_failed_attempt(ip: str):
    now   = time.time()
    entry = login_attempts.setdefault(ip, {"count": 0, "locked_until": None})
    entry["count"] += 1
    if entry["count"] >= MAX_ATTEMPTS:
        entry["locked_until"] = now + LOCKOUT_SECS
        print(f"[SECURITY] IP {ip} locked out after {MAX_ATTEMPTS} failed login attempts.")


def _clear_attempts(ip: str):
    login_attempts.pop(ip, None)


@app.route("/api/login", methods=["POST"])
def login():
    data     = request.json or {}
    email    = data.get("email", "").strip().lower()
    password = data.get("password", "")
    ip       = _get_client_ip()

    if not email or not password:
        return jsonify({"success": False, "message": "Email and password are required."}), 400

    # ── Rate limiting check ──
    locked, secs = _is_rate_limited(ip)
    if locked:
        mins = secs // 60
        return jsonify({
            "success": False,
            "message": f"Too many failed attempts. Please wait {mins} minute(s) before trying again."
        }), 429

    try:
        query = supabase.table("admins").select("*").eq("email", email).execute()

        if not query.data:
            _record_failed_attempt(ip)
            return jsonify({"success": False, "message": "Invalid email or password."}), 401

        user = query.data[0]

        # ── Password verification (bcrypt-aware) ──
        stored_pw = user.get("password", "")
        if not _check_password(password, stored_pw):
            _record_failed_attempt(ip)
            return jsonify({"success": False, "message": "Invalid email or password."}), 401

        # ── Auto-upgrade legacy plain-text password to bcrypt ──
        if not (stored_pw.startswith("$2b$") or stored_pw.startswith("$2a$")):
            try:
                new_hash = _hash_password(password)
                supabase.table("admins").update({"password": new_hash}).eq("admin_id", user["admin_id"]).execute()
                print(f"[SECURITY] Auto-upgraded password hash for user {user.get('admin_user')}")
            except Exception as e:
                print(f"[SECURITY] Hash upgrade failed (non-critical): {e}")

        if user.get("status", "Active") != "Active":
            return jsonify({"success": False, "message": "Your account is deactivated. Contact your administrator."}), 403

        _clear_attempts(ip)  # reset on successful login
        token = create_access_token(identity=str(user["admin_id"]))

        return jsonify({
            "success": True,
            "token":   token,
            "user": {
                "admin_id":   user.get("admin_id"),
                "admin_user": user.get("admin_user"),
                "email":      user.get("email"),
                "status":     user.get("status", "Active"),
            }
        }), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# ==========================================
# 4. [API] FETCH ALL DATA (DASHBOARD)
# ==========================================
@app.route("/api/data", methods=["GET"])
def get_all_data():
    try:
        try:    products   = supabase.table("products").select("*").execute().data
        except: products   = []
        try:    movements  = supabase.table("stock_movements").select("*").order("updated_at", desc=True).limit(20).execute().data
        except:
            try: movements = supabase.table("stock_movements").select("*").order("created_at",  desc=True).limit(20).execute().data
            except: movements = []
        try:    suppliers  = supabase.table("suppliers").select("*").execute().data
        except: suppliers  = []
        try:    categories = supabase.table("categories").select("*").execute().data
        except: categories = []

        return jsonify({
            "products":        products   or [],
            "stock_movements": movements  or [],
            "suppliers":       suppliers  or [],
            "categories":      categories or [],
        }), 200
    except Exception as e:
        print(f"System Error: {e}")
        return jsonify({"error": str(e)}), 500


# ==========================================
# 4b. [API] MOVEMENTS ONLY (fast refresh)
# ==========================================
@app.route("/api/movements", methods=["GET"])
def get_movements():
    try:
        try:    res = supabase.table("stock_movements").select("*").order("updated_at", desc=True).limit(50).execute()
        except: res = supabase.table("stock_movements").select("*").order("created_at",  desc=True).limit(50).execute()
        return jsonify({"success": True, "data": res.data or []})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# ==========================================
# 5. [API] USERS / ADMIN MANAGEMENT
# ==========================================
@app.route("/api/users", methods=["GET"])
def get_users():
    try:
        res = supabase.table("admins").select("*").execute()
        return jsonify({"success": True, "data": res.data}), 200
    except Exception as e:
        print(f"GET USERS ERROR: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/users", methods=["POST"])
def add_user():
    data = request.json or {}
    try:
        new_user = {
            "admin_user": data.get("admin_user"),
            "email":      data.get("email"),
            "password":   _hash_password(data.get("password", "")),  # always bcrypt-hashed

            "status":     data.get("status", "Active"),
        }
        res = supabase.table("admins").insert(new_user).execute()
        return jsonify({"success": True, "data": res.data[0]}), 200
    except Exception as e:
        print(f"ADD USER ERROR: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/users/<int:admin_id>", methods=["PUT"])
def update_user(admin_id):
    data = request.json or {}
    try:
        update_data = {
            "admin_user": data.get("admin_user"),
            "email":      data.get("email"),
            "status":     data.get("status"),
        }
        if data.get("password"):
            update_data["password"] = _hash_password(data["password"])  # bcrypt before storing
        res = supabase.table("admins").update(update_data).eq("admin_id", admin_id).execute()
        return jsonify({"success": True, "data": res.data[0]}), 200
    except Exception as e:
        print(f"UPDATE USER ERROR: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


# ==========================================
# 6. [API] SUPPLIERS MANAGEMENT
# ==========================================
@app.route("/api/suppliers", methods=["POST"])
def add_supplier():
    data = request.json or {}
    try:
        new_supplier = {
            "company_name":   data.get("company_name"),
            "contact_person": data.get("contact_person"),
            "contact_number": data.get("contact_number"),
            "email_address":  data.get("email_address"),
            "brand":          data.get("brand"),
            "is_active":      True,
        }
        res = supabase.table("suppliers").insert(new_supplier).execute()
        return jsonify({"success": True, "data": res.data[0]}), 200
    except Exception as e:
        print(f"SUPABASE INSERT ERROR: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/suppliers/<int:supplier_id>", methods=["PUT"])
def update_supplier(supplier_id):
    data = request.json or {}
    try:
        updated_data = {
            "company_name":   data.get("company_name"),
            "contact_person": data.get("contact_person"),
            "contact_number": data.get("contact_number"),
            "email_address":  data.get("email_address"),
            "brand":          data.get("brand"),
        }
        res = supabase.table("suppliers").update(updated_data).eq("supplier_id", supplier_id).execute()
        return jsonify({"success": True, "data": res.data[0]}), 200
    except Exception as e:
        print(f"SUPABASE UPDATE ERROR: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


# ==========================================
# VALIDATION HELPERS — clamp inputs to safe ranges
# ==========================================
MAX_PRICE     = 99999   # 5 digits max
MAX_STOCK     = 999999  # reasonable stock ceiling
MAX_NAME_LEN  = 100

def _clamp_price(val):
    """Ensure price is 0 <= price <= 99999, no negatives."""
    try:
        v = float(val or 0)
        return max(0.0, min(v, MAX_PRICE))
    except (TypeError, ValueError):
        return 0.0

def _clamp_int(val, min_val=0, max_val=MAX_STOCK):
    """Ensure integer is within safe range, no negatives."""
    try:
        v = int(float(val or 0))
        return max(min_val, min(v, max_val))
    except (TypeError, ValueError):
        return min_val


# ==========================================
# 7. [API] PRODUCTS MANAGEMENT (Image Upload)
# ==========================================
@app.route("/api/products", methods=["POST"])
def add_product():
    try:
        name        = request.form.get("name")
        category_id = request.form.get("category_id")
        supplier_id = request.form.get("supplier_id")
        unit        = request.form.get("unit_of_measurement")
        price       = request.form.get("price")
        stock       = request.form.get("stock_quantity")
        low_stock   = request.form.get("low_stock_threshold")

        new_product = {
            "name":                (name or '')[:MAX_NAME_LEN],
            "category_id":         int(category_id) if category_id and category_id != "null" else None,
            "supplier_id":         int(supplier_id) if supplier_id and supplier_id != "null" else None,
            "unit_of_measurement": unit,
            "price":               _clamp_price(price),
            "stock_quantity":      _clamp_int(stock),
            "initial_inventory":   _clamp_int(stock),
            "available_quantity":  _clamp_int(stock),
            "sold_qty":            0,
            "final_cost":          0,
            "low_stock_threshold": _clamp_int(low_stock, min_val=0, max_val=99999) if low_stock else 10,
            "is_active":           True,
        }

        if "image" in request.files:
            file = request.files["image"]
            if file.filename != "":
                ext             = os.path.splitext(file.filename)[1]
                unique_filename = f"{uuid.uuid4()}{ext}"
                file_bytes      = file.read()
                supabase.storage.from_("product-images").upload(
                    path=unique_filename, file=file_bytes,
                    file_options={"content-type": file.content_type}
                )
                pub = supabase.storage.from_("product-images").get_public_url(unique_filename)
                new_product["image_path"] = pub if isinstance(pub, str) else pub.get("publicUrl")

        res = supabase.table("products").insert(new_product).execute()
        return jsonify({"success": True, "data": res.data[0]}), 200
    except Exception as e:
        print(f"ADD PRODUCT ERROR: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/products/<int:product_id>", methods=["DELETE", "OPTIONS"])
def delete_product(product_id):
    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200
    try:
        # Step 1: Delete related stock_movements first to avoid FK constraint blocking the delete
        supabase_admin.table("stock_movements").delete().eq("product_id", product_id).execute()

        # Step 2: Delete the product itself
        res = supabase_admin.table("products").delete().eq("product_id", product_id).execute()

        # Step 3: Verify a row was actually deleted — Supabase returns the deleted rows in res.data
        if not res.data:
            print(f"DELETE PRODUCT WARNING: No row deleted for product_id={product_id}")
            return jsonify({"success": False, "message": f"Product {product_id} not found or could not be deleted."}), 404

        print(f"DELETE PRODUCT SUCCESS: product_id={product_id}")
        return jsonify({"success": True}), 200

    except Exception as e:
        print(f"DELETE PRODUCT ERROR: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/products/<int:product_id>", methods=["PUT"])
def update_product(product_id):
    try:
        name        = request.form.get("name")
        category_id = request.form.get("category_id")
        supplier_id = request.form.get("supplier_id")
        unit        = request.form.get("unit_of_measurement")
        price       = request.form.get("price")
        stock       = request.form.get("stock_quantity")
        low_stock   = request.form.get("low_stock_threshold")
        sold        = request.form.get("sold_qty")

        update_data = {
            "name":                (name or '')[:MAX_NAME_LEN],
            "category_id":         int(category_id) if category_id and category_id != "null" else None,
            "supplier_id":         int(supplier_id) if supplier_id and supplier_id != "null" else None,
            "unit_of_measurement": unit,
            "price":               _clamp_price(price),
            "stock_quantity":      _clamp_int(stock) if stock is not None and stock != "null" else 0,
            "available_quantity":  _clamp_int(stock) if stock is not None and stock != "null" else 0,
            "sold_qty":            _clamp_int(sold)  if sold  is not None and sold  != "null" else 0,
            "final_cost":          _clamp_price(price) * (_clamp_int(sold) if sold is not None and sold != "null" else 0),
            "low_stock_threshold": _clamp_int(low_stock, min_val=0, max_val=99999) if low_stock is not None and low_stock != "null" else 10,
            "updated_at":          "now()",
        }

        if "image" in request.files:
            file = request.files["image"]
            if file.filename != "":
                ext             = os.path.splitext(file.filename)[1]
                unique_filename = f"{uuid.uuid4()}{ext}"
                file_bytes      = file.read()
                supabase.storage.from_("product-images").upload(
                    path=unique_filename, file=file_bytes,
                    file_options={"content-type": file.content_type}
                )
                pub = supabase.storage.from_("product-images").get_public_url(unique_filename)
                update_data["image_path"] = pub if isinstance(pub, str) else pub.get("publicUrl")

        res = supabase.table("products").update(update_data).eq("product_id", product_id).execute()
        return jsonify({"success": True, "data": res.data[0]}), 200
    except Exception as e:
        print(f"PRODUCT UPDATE ERROR: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


# ==========================================
# 7b. [API] SELL PRODUCT
# ==========================================
@app.route("/api/products/<int:product_id>/sell", methods=["POST", "OPTIONS"])
def sell_product(product_id):
    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200

    data        = request.json or {}
    qty_to_sell = int(data.get("qty", 0))

    if qty_to_sell <= 0:
        return jsonify({"success": False, "message": "Invalid quantity."}), 400

    try:
        product       = supabase.table("products").select("*").eq("product_id", product_id).single().execute().data
        current_stock = int(product.get("stock_quantity", 0))
        current_sold  = int(product.get("sold_qty",       0))
        price         = float(product.get("price",        0))

        if qty_to_sell > current_stock:
            return jsonify({"success": False, "message": "Not enough stock!"}), 400

        new_stock      = current_stock - qty_to_sell
        new_sold       = current_sold  + qty_to_sell
        new_final_cost = price * new_sold

        supabase.table("products").update({
            "stock_quantity":     new_stock,
            "available_quantity": new_stock,
            "sold_qty":           new_sold,
            "final_cost":         new_final_cost,
            "updated_at":         "now()",
        }).eq("product_id", product_id).execute()

        supabase.table("stock_movements").insert({
            "product_id":      product_id,
            "movement_type":   "Sold",
            "quantity_change": -qty_to_sell,
        }).execute()

        socketio.emit("stock_updated", {
            "product_id":         product_id,
            "stock_quantity":     new_stock,
            "available_quantity": new_stock,
            "sold_qty":           new_sold,
            "final_cost":         new_final_cost,
        })

        return jsonify({
            "success": True,
            "data": {
                "product_id":     product_id,
                "new_stock":      new_stock,
                "new_sold":       new_sold,
                "new_final_cost": new_final_cost,
            }
        }), 200

    except Exception as e:
        print(f"SELL PRODUCT ERROR: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


# ==========================================
# 7c. [API] ADJUST STOCK (Add / Deduct)
# ==========================================
@app.route("/api/products/<int:product_id>/adjust", methods=["POST", "OPTIONS"])
def adjust_product_stock(product_id):
    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200

    data   = request.json or {}
    qty    = int(data.get("qty", 0))
    a_type = data.get("type", "Add")  # "Add" or "Deduct"

    if qty <= 0:
        return jsonify({"success": False, "message": "Quantity must be greater than zero."}), 400
    if a_type not in ("Add", "Deduct"):
        return jsonify({"success": False, "message": "Type must be 'Add' or 'Deduct'."}), 400

    try:
        product       = supabase.table("products").select("*").eq("product_id", product_id).single().execute().data
        current_stock = int(product.get("stock_quantity", 0))
        new_stock     = (current_stock + qty) if a_type == "Add" else max(0, current_stock - qty)

        supabase.table("products").update({
            "stock_quantity":     new_stock,
            "available_quantity": new_stock,
            "updated_at":         "now()",
        }).eq("product_id", product_id).execute()

        supabase.table("stock_movements").insert({
            "product_id":      product_id,
            "movement_type":   a_type,
            "quantity_change": qty if a_type == "Add" else -qty,
        }).execute()

        socketio.emit("stock_updated", {
            "product_id":         product_id,
            "stock_quantity":     new_stock,
            "available_quantity": new_stock,
        })

        return jsonify({
            "success": True,
            "data": {
                "product_id":     product_id,
                "stock_quantity": new_stock,
            }
        }), 200

    except Exception as e:
        print(f"ADJUST STOCK ERROR: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


# ==========================================
# 8. [SOCKET] REAL-TIME STOCK ADJUSTMENT
# ==========================================
@socketio.on("adjust_stock")
def handle_adjust_stock(data):
    p_id   = data.get("id")
    qty    = int(data.get("qty"))
    a_type = data.get("type")
    try:
        prod   = supabase.table("products").select("*").eq("product_id", p_id).single().execute().data
        curr_q = int(prod.get("stock_quantity", 0))
        new_q  = (curr_q + qty) if a_type == "Add" else max(0, curr_q - qty)

        supabase.table("products").update({
            "stock_quantity":     new_q,
            "available_quantity": new_q,
        }).eq("product_id", p_id).execute()

        supabase.table("stock_movements").insert({
            "product_id":      p_id,
            "movement_type":   a_type,
            "quantity_change": qty if a_type == "Add" else -qty,
        }).execute()

        emit("stock_updated", {"product_id": p_id, "stock_quantity": new_q, "available_quantity": new_q}, broadcast=True)
    except Exception as e:
        print(f"SOCKET ERROR: {e}")


# ==========================================
# 9. [API] CATEGORIES MANAGEMENT
# ==========================================
@app.route("/api/categories", methods=["POST", "OPTIONS"])
def add_category():
    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200
    data          = request.json or {}
    category_name = data.get("category_name")
    if not category_name:
        return jsonify({"success": False, "message": "Category name is required"}), 400
    try:
        res = supabase.table("categories").insert({"category_name": category_name}).execute()
        return jsonify({"success": True, "data": res.data[0]}), 200
    except Exception as e:
        print(f"ADD CATEGORY ERROR: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/categories/<int:category_id>", methods=["DELETE", "OPTIONS"])
def delete_category(category_id):
    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200
    try:
        supabase.table("categories").delete().eq("category_id", category_id).execute()
        return jsonify({"success": True}), 200
    except Exception as e:
        print(f"DELETE CATEGORY ERROR: {e}")
        return jsonify({"success": False, "message": "Cannot delete. Category might be in use by a product."}), 500


# ==========================================
# 10. [API] FORGOT PASSWORD — Full OTP Flow
# ==========================================
@app.route("/api/verify-email", methods=["POST", "OPTIONS"])
def verify_email():
    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200
    data  = request.json or {}
    email = data.get("email", "").strip()
    try:
        query = supabase.table("admins").select("admin_id,email").eq("email", email).execute()
        if query.data:
            return jsonify({"success": True, "message": "Email found"}), 200
        return jsonify({"success": False, "message": "Email not found in our records."}), 404
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/send-otp", methods=["POST", "OPTIONS"])
def send_otp():
    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200

    data  = request.json or {}
    email = data.get("email", "").strip()

    if not email:
        return jsonify({"success": False, "message": "Email is required."}), 400

    try:
        query = supabase.table("admins").select("admin_id,admin_user,email").eq("email", email).execute()
        if not query.data:
            return jsonify({"success": False, "message": "No account found with that email."}), 404

        user     = query.data[0]
        otp_code = str(random.randint(100000, 999999))
        token    = str(uuid.uuid4())

        with otp_lock:
            otp_store[token] = {
                "otp":        otp_code,
                "email":      email,
                "expires_at": time.time() + 600,  # 10 minutes
            }

        html_body = f"""
        <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;">
          <div style="background:#0f172a;padding:20px 24px;border-radius:8px 8px 0 0;text-align:center;">
            <h1 style="color:white;margin:0;font-size:1.3rem;letter-spacing:1px;">JEMARIELL</h1>
            <span style="color:#94a3b8;font-size:0.8rem;">General Merchandising</span>
          </div>
          <div style="background:white;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;">
            <p style="color:#475569;margin-top:0;">Hi <strong>{user.get("admin_user", "User")}</strong>,</p>
            <p style="color:#475569;">Your password reset verification code is:</p>
            <div style="text-align:center;margin:24px 0;">
              <span style="font-size:2.5rem;font-weight:800;letter-spacing:0.4em;color:#0f172a;
                           background:#f1f5f9;padding:12px 24px;border-radius:8px;">{otp_code}</span>
            </div>
            <p style="color:#64748b;font-size:0.875rem;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
            <p style="color:#94a3b8;font-size:0.8rem;">If you did not request this, please ignore this email.</p>
          </div>
        </div>
        """

        email_sent = send_email(email, "Your JEMARIELL Password Reset Code", html_body,
                                f"Your OTP is: {otp_code}  (expires in 10 minutes)")

        if not email_sent:
            print(f"\n{'='*45}")
            print(f"[DEV MODE] OTP for {email}: {otp_code}")
            print(f"{'='*45}\n")

        return jsonify({
            "success":   True,
            "otp_token": token,
            "message":   "Verification code sent to your email." if email_sent
                         else "OTP printed to server terminal (email not configured).",
        }), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/verify-otp", methods=["POST", "OPTIONS"])
def verify_otp():
    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200

    data      = request.json or {}
    otp_token = data.get("otp_token", "").strip()
    otp_code  = data.get("otp_code",  "").strip()

    with otp_lock:
        entry = otp_store.get(otp_token)
        if not entry:
            return jsonify({"success": False, "message": "Invalid or expired session. Please request a new code."}), 400
        if time.time() > entry["expires_at"]:
            del otp_store[otp_token]
            return jsonify({"success": False, "message": "Verification code has expired. Please request a new one."}), 400
        if entry["otp"] != otp_code:
            return jsonify({"success": False, "message": "Incorrect code. Please check and try again."}), 400

        reset_token = str(uuid.uuid4())
        reset_store[reset_token] = {
            "email":      entry["email"],
            "expires_at": time.time() + 300,  # 5 minutes
        }
        del otp_store[otp_token]

    return jsonify({"success": True, "reset_token": reset_token}), 200


@app.route("/api/reset-password", methods=["POST", "OPTIONS"])
def reset_password():
    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200

    data         = request.json or {}
    email        = data.get("email",       "").strip()
    new_password = data.get("password",    "").strip()
    reset_token  = data.get("reset_token", "").strip()

    if not new_password or len(new_password) < 6:
        return jsonify({"success": False, "message": "Password must be at least 6 characters."}), 400

    entry = reset_store.get(reset_token)
    if not entry:
        return jsonify({"success": False, "message": "Invalid or expired reset session. Please start over."}), 400
    if time.time() > entry["expires_at"]:
        del reset_store[reset_token]
        return jsonify({"success": False, "message": "Reset session expired. Please start over."}), 400
    if entry["email"] != email:
        return jsonify({"success": False, "message": "Email mismatch. Please start over."}), 400

    try:
        supabase.table("admins").update({"password": _hash_password(new_password)}).eq("email", email).execute()  # bcrypt
        del reset_store[reset_token]
        return jsonify({"success": True, "message": "Password updated successfully."}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# ==========================================
# 11. [API] STOCK REPORT PDF (ReportLab)
# ==========================================
@app.route("/api/report/stock", methods=["POST", "OPTIONS"])
def generate_stock_report():
    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200

    try:
        body              = request.json or {}
        category_filter   = body.get("category",         "All")
        product_filter    = body.get("product",           "All")
        date_label        = body.get("dateRange",         "All Time")
        generated_by      = body.get("generated_by",     "Admin")
        include_movements = body.get("include_movements", True)

        try:    products   = supabase.table("products").select("*").execute().data or []
        except: products   = []
        try:    categories = supabase.table("categories").select("*").execute().data or []
        except: categories = []
        try:    movements  = supabase.table("stock_movements").select("*").order("updated_at", desc=True).limit(50).execute().data or []
        except:
            try: movements = supabase.table("stock_movements").select("*").order("created_at", desc=True).limit(50).execute().data or []
            except: movements = []

        cat_map = {c["category_id"]: c["category_name"] for c in categories}

        def get_cat(cid):  return cat_map.get(cid, "Unknown")
        def get_status(p):
            qty = p.get("stock_quantity") or 0
            thr = p.get("low_stock_threshold") or 0
            if qty == 0:   return "Out of Stock"
            if qty <= thr: return "Low Stock"
            return "In Stock"

        filtered = products
        if category_filter != "All":
            filtered = [p for p in filtered if str(p.get("category_id")) == str(category_filter)]
        if product_filter != "All":
            filtered = [p for p in filtered if str(p.get("product_id")) == str(product_filter)]

        total_revenue = sum((p.get("sold_qty") or 0) * (p.get("price") or 0) for p in filtered)
        total_units   = sum( p.get("sold_qty") or 0                           for p in filtered)
        inv_value     = sum((p.get("stock_quantity") or 0) * (p.get("price") or 0) for p in filtered)

        cat_sales = {}
        for p in filtered:
            cname = get_cat(p.get("category_id"))
            cat_sales[cname] = cat_sales.get(cname, 0) + (p.get("sold_qty") or 0) * (p.get("price") or 0)

        DARK   = colors.HexColor("#0f172a")
        ORANGE = colors.HexColor("#ea580c")
        GREEN  = colors.HexColor("#16a34a")
        RED    = colors.HexColor("#dc2626")
        YELLOW = colors.HexColor("#ca8a04")
        LIGHT  = colors.HexColor("#f8fafc")
        BORDER = colors.HexColor("#e2e8f0")
        WHITE  = colors.white
        MUTED  = colors.HexColor("#64748b")

        def ps(name, **kw): return ParagraphStyle(name, **kw)

        normal   = ps("N",  fontName="Helvetica",      fontSize=8, textColor=DARK, leading=11)
        bold     = ps("B",  fontName="Helvetica-Bold", fontSize=8, textColor=DARK, leading=11)
        normal_r = ps("NR", fontName="Helvetica",      fontSize=8, textColor=DARK, leading=11, alignment=TA_RIGHT)
        bold_r   = ps("BR", fontName="Helvetica-Bold", fontSize=8, textColor=DARK, leading=11, alignment=TA_RIGHT)
        hdr_st   = ps("H",  fontName="Helvetica-Bold", fontSize=8, textColor=WHITE)
        hdr_r_st = ps("HR", fontName="Helvetica-Bold", fontSize=8, textColor=WHITE, alignment=TA_RIGHT)
        section  = ps("S",  fontName="Helvetica-Bold", fontSize=9, textColor=DARK, spaceBefore=10, spaceAfter=4)

        def status_p(s):
            c = GREEN if s == "In Stock" else (YELLOW if s == "Low Stock" else RED)
            return Paragraph(s, ps(f"st{s}", fontName="Helvetica-Bold", fontSize=7, textColor=c))

        def H(txt, right=False):
            return Paragraph(txt, hdr_r_st if right else hdr_st)

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=landscape(A4),
                                leftMargin=1.5*cm, rightMargin=1.5*cm,
                                topMargin=1.5*cm,  bottomMargin=1.5*cm)
        W   = landscape(A4)[0] - 3*cm
        els = []

        els.append(Table(
            [[Paragraph("JEMARIELL GENERAL MERCHANDISING INC",
                        ps("T", fontName="Helvetica-Bold", fontSize=16, textColor=WHITE)),
              Paragraph(f"Stock Report  |  {date_label}<br/>"
                        f'<font size="7" color="#94a3b8">'
                        f'Generated: {datetime.now().strftime("%b %d, %Y %I:%M %p")}  |  By: {generated_by}'
                        f"</font>",
                        ps("SB", fontName="Helvetica", fontSize=8,
                           textColor=colors.HexColor("#cbd5e1"), alignment=TA_RIGHT))]],
            colWidths=[W*0.6, W*0.4]
        ))
        els[-1].setStyle(TableStyle([
            ("BACKGROUND",    (0,0),(-1,-1), DARK),
            ("VALIGN",        (0,0),(-1,-1), "MIDDLE"),
            ("TOPPADDING",    (0,0),(-1,-1), 12),
            ("BOTTOMPADDING", (0,0),(-1,-1), 12),
            ("LEFTPADDING",   (0,0),(0,-1),  14),
            ("RIGHTPADDING",  (-1,0),(-1,-1),14),
        ]))
        els.append(Spacer(1, 10))

        def kpi_cell(label, value):
            return Table(
                [[Paragraph(label, ps("kl", fontName="Helvetica",      fontSize=7,  textColor=MUTED))],
                 [Paragraph(value, ps("kv", fontName="Helvetica-Bold", fontSize=12, textColor=DARK))]],
                colWidths=[W/3 - 8]
            )

        kpi_row = Table([[
            kpi_cell("Total Sales Revenue",    f"PHP {total_revenue:,.2f}"),
            kpi_cell("Total Units Sold",        f"{total_units:,} units"),
            kpi_cell("Current Inventory Value", f"PHP {inv_value:,.2f}"),
        ]], colWidths=[W/3]*3)
        kpi_row.setStyle(TableStyle([
            ("BOX",           (0,0),(-1,-1), 0.5, BORDER),
            ("INNERGRID",     (0,0),(-1,-1), 0.5, BORDER),
            ("BACKGROUND",    (0,0),(-1,-1), LIGHT),
            ("TOPPADDING",    (0,0),(-1,-1), 8),
            ("BOTTOMPADDING", (0,0),(-1,-1), 8),
            ("LEFTPADDING",   (0,0),(-1,-1), 12),
        ]))
        els.append(kpi_row)
        els.append(Spacer(1, 10))

        els.append(Paragraph("Product Inventory", section))
        CW   = [0.04*W, 0.20*W, 0.11*W, 0.08*W, 0.05*W, 0.05*W,
                0.07*W, 0.07*W, 0.11*W, 0.11*W, 0.09*W]
        rows = [[H("#"), H("Product Name"), H("Category"), H("Price", True),
                 H("Init", True), H("Unit"), H("Sold", True), H("Stock", True),
                 H("Revenue", True), H("Inv. Value", True), H("Status")]]

        for i, p in enumerate(filtered, 1):
            sold  = int(p.get("sold_qty") or 0)
            stock = int(p.get("stock_quantity") or 0)
            price = p.get("price") or 0
            rows.append([
                Paragraph(str(i),                                    normal),
                Paragraph(p.get("name", "—"),                        bold),
                Paragraph(get_cat(p.get("category_id")),             normal),
                Paragraph(f"PHP {price:,.2f}",                       normal_r),
                Paragraph(str(int(p.get("initial_inventory") or 0)), normal_r),
                Paragraph(p.get("unit_of_measurement", "pc"),        normal),
                Paragraph(str(sold),                                  normal_r),
                Paragraph(str(stock),                                 bold_r),
                Paragraph(f"PHP {sold*price:,.2f}",                  normal_r),
                Paragraph(f"PHP {stock*price:,.2f}",                 normal_r),
                status_p(get_status(p)),
            ])

        pt = Table(rows, colWidths=CW, repeatRows=1)
        pt.setStyle(TableStyle([
            ("BACKGROUND",    (0,0),(-1,0), DARK),
            ("LINEBELOW",     (0,0),(-1,0), 1.5, ORANGE),
            ("GRID",          (0,0),(-1,-1), 0.25, BORDER),
            ("VALIGN",        (0,0),(-1,-1), "MIDDLE"),
            ("TOPPADDING",    (0,0),(-1,-1), 5),
            ("BOTTOMPADDING", (0,0),(-1,-1), 5),
            ("LEFTPADDING",   (0,0),(-1,-1), 5),
            ("RIGHTPADDING",  (0,0),(-1,-1), 5),
            *[("BACKGROUND", (0,i),(-1,i), LIGHT if i%2==0 else WHITE)
              for i in range(1, len(rows))],
        ]))
        els.append(pt)
        els.append(Spacer(1, 10))

        if cat_sales:
            els.append(Paragraph("Sales by Category", section))
            crow = [[H("Category"), H("Total Revenue", True)]]
            for cname, cs in sorted(cat_sales.items(), key=lambda x: -x[1]):
                crow.append([Paragraph(cname, normal), Paragraph(f"PHP {cs:,.2f}", bold_r)])
            ct = Table(crow, colWidths=[W*0.5, W*0.5])
            ct.setStyle(TableStyle([
                ("BACKGROUND",    (0,0),(-1,0), colors.HexColor("#334155")),
                ("LINEBELOW",     (0,0),(-1,0), 1.5, ORANGE),
                ("GRID",          (0,0),(-1,-1), 0.25, BORDER),
                ("TOPPADDING",    (0,0),(-1,-1), 5),
                ("BOTTOMPADDING", (0,0),(-1,-1), 5),
                ("LEFTPADDING",   (0,0),(-1,-1), 10),
                ("RIGHTPADDING",  (0,0),(-1,-1), 10),
                *[("BACKGROUND", (0,i),(-1,i), LIGHT if i%2==0 else WHITE)
                  for i in range(1, len(crow))],
            ]))
            els.append(ct)
            els.append(Spacer(1, 10))

        if include_movements and movements:
            els.append(Paragraph("Recent Stock Movements", section))
            prod_map = {p["product_id"]: p["name"] for p in products}
            mrows    = [[H("ID"), H("Product"), H("Type"), H("Qty", True), H("Date")]]
            for m in movements[:50]:
                qty  = m.get("quantity_change", 0)
                date = m.get("updated_at") or m.get("created_at") or "—"
                try:
                    date = datetime.fromisoformat(date.replace("Z", "+00:00")).strftime("%b %d, %Y %H:%M")
                except: pass
                qc = GREEN if (qty or 0) > 0 else RED
                mrows.append([
                    Paragraph(str(m.get("movement_id", "—")), normal),
                    Paragraph(prod_map.get(m.get("product_id"), "Unknown"), normal),
                    Paragraph(m.get("movement_type", "—"), bold),
                    Paragraph(f"+{qty}" if (qty or 0) > 0 else str(qty),
                              ps("qp", fontName="Helvetica-Bold", fontSize=8, textColor=qc, alignment=TA_RIGHT)),
                    Paragraph(date, normal),
                ])
            mcw = [0.06*W, 0.28*W, 0.14*W, 0.12*W, 0.22*W]
            mt  = Table(mrows, colWidths=mcw, repeatRows=1)
            mt.setStyle(TableStyle([
                ("BACKGROUND",    (0,0),(-1,0), colors.HexColor("#1e3a5f")),
                ("LINEBELOW",     (0,0),(-1,0), 1.5, colors.HexColor("#3b82f6")),
                ("GRID",          (0,0),(-1,-1), 0.25, BORDER),
                ("VALIGN",        (0,0),(-1,-1), "MIDDLE"),
                ("TOPPADDING",    (0,0),(-1,-1), 5),
                ("BOTTOMPADDING", (0,0),(-1,-1), 5),
                ("LEFTPADDING",   (0,0),(-1,-1), 6),
                ("RIGHTPADDING",  (0,0),(-1,-1), 6),
                *[("BACKGROUND", (0,i),(-1,i), LIGHT if i%2==0 else WHITE)
                  for i in range(1, len(mrows))],
            ]))
            els.append(mt)
            els.append(Spacer(1, 10))

        els.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
        els.append(Spacer(1, 4))
        els.append(Paragraph(
            f"© {datetime.now().year} Jemariell General Merchandising Inc.  |  System-generated report.",
            ps("ft", fontName="Helvetica", fontSize=7, textColor=MUTED, alignment=TA_CENTER)
        ))

        doc.build(els)
        buf.seek(0)
        filename = f"jemariell_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        return send_file(buf, mimetype="application/pdf", as_attachment=True, download_name=filename)

    except Exception as e:
        print(f"REPORT ERROR: {e}")
        import traceback; traceback.print_exc()
        return jsonify({"success": False, "message": str(e)}), 500



# ==========================================
# [DEBUG] EMAIL CONFIG CHECK & TEST
# Remove these routes before going to production
# ==========================================
@app.route("/api/debug/email-config", methods=["GET"])
def debug_email_config():
    sender   = os.environ.get("EMAIL_SENDER",   "NOT SET")
    password = os.environ.get("EMAIL_PASSWORD", "NOT SET")
    return jsonify({
        "EMAIL_SENDER":   sender,
        "EMAIL_PASSWORD": ("SET — " + "*" * len(password) + f" ({len(password)} chars)") if password and password != "NOT SET" else "NOT SET / EMPTY",
        "dotenv_loaded":  bool(sender and password),
        "tip": "If values show NOT SET, your .env file path is wrong or variables are misspelled."
    }), 200


@app.route("/api/debug/test-email", methods=["POST"])
def debug_test_email():
    data = request.json or {}
    to   = data.get("to", EMAIL_SENDER)
    if not to:
        return jsonify({"success": False, "message": "No recipient — set EMAIL_SENDER in .env first"}), 400
    html = "<h2>✅ JEMARIELL Email Test</h2><p>If you see this, your Gmail SMTP is working correctly!</p>"
    ok   = send_email(to, "JEMARIELL Email Test", html, "Email test successful!")
    if ok:
        return jsonify({"success": True,  "message": f"Test email sent to {to}. Check your inbox!"}), 200
    else:
        return jsonify({"success": False, "message": "send_email() returned False. Check Flask terminal for the exact SMTP error."}), 500

# ==========================================
# 12. [SCHEDULER] WEEKLY EMAIL REPORT
# ==========================================
def _weekly_report_job():
    """Fetch inventory summary and email the weekly report."""
    try:
        products        = supabase.table("products").select("*").execute().data or []
        total_products  = len(products)
        total_stock_qty = sum(int(p.get("stock_quantity") or 0) for p in products)
        total_stock_val = sum((p.get("stock_quantity") or 0) * (p.get("price") or 0) for p in products)
        total_revenue   = sum((p.get("sold_qty") or 0) * (p.get("price") or 0) for p in products)
        low_stock_items = [p for p in products
                           if 0 < int(p.get("stock_quantity") or 0) <= int(p.get("low_stock_threshold") or 0)]
        out_of_stock    = [p for p in products if int(p.get("stock_quantity") or 0) == 0]

        low_stock_rows = "".join(
            f"<tr><td style='padding:8px 12px;border-bottom:1px solid #f1f5f9'>{p.get('name','—')}</td>"
            f"<td style='padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#ca8a04;font-weight:600'>{p.get('stock_quantity')}</td></tr>"
            for p in low_stock_items[:10]
        ) or "<tr><td colspan='2' style='padding:12px;color:#64748b;text-align:center'>All items are well-stocked ✓</td></tr>"

        out_rows = "".join(
            f"<tr><td style='padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#dc2626'>{p.get('name','—')}</td></tr>"
            for p in out_of_stock[:10]
        ) or "<tr><td style='padding:12px;color:#64748b;text-align:center'>No items out of stock ✓</td></tr>"

        week_str = datetime.now().strftime("%B %d, %Y")

        html = f"""
        <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#0f172a;padding:24px;border-radius:8px 8px 0 0;">
            <h1 style="color:white;margin:0;font-size:1.2rem;letter-spacing:1px;">JEMARIELL</h1>
            <p style="color:#94a3b8;margin:4px 0 0;font-size:0.85rem;">Weekly Inventory Summary — Week of {week_str}</p>
          </div>
          <div style="background:white;padding:24px;border:1px solid #e2e8f0;">
            <table width="100%" style="margin-bottom:24px;border-collapse:collapse;">
              <tr>
                <td style="padding:16px;background:#f8fafc;border-radius:8px;text-align:center;width:24%">
                  <div style="font-size:1.8rem;font-weight:800;color:#0f172a">{total_products}</div>
                  <div style="font-size:0.75rem;color:#64748b">Total Products</div>
                </td>
                <td style="width:2%"></td>
                <td style="padding:16px;background:#f8fafc;border-radius:8px;text-align:center;width:24%">
                  <div style="font-size:1.8rem;font-weight:800;color:#0f172a">{total_stock_qty:,}</div>
                  <div style="font-size:0.75rem;color:#64748b">Units in Stock</div>
                </td>
                <td style="width:2%"></td>
                <td style="padding:16px;background:#f8fafc;border-radius:8px;text-align:center;width:24%">
                  <div style="font-size:1.2rem;font-weight:800;color:#16a34a">PHP {total_revenue:,.0f}</div>
                  <div style="font-size:0.75rem;color:#64748b">Total Revenue</div>
                </td>
                <td style="width:2%"></td>
                <td style="padding:16px;background:#f8fafc;border-radius:8px;text-align:center;width:22%">
                  <div style="font-size:1.2rem;font-weight:800;color:#2563eb">PHP {total_stock_val:,.0f}</div>
                  <div style="font-size:0.75rem;color:#64748b">Inventory Value</div>
                </td>
              </tr>
            </table>
            <h3 style="margin:0 0 12px;color:#854d0e;font-size:0.9rem;text-transform:uppercase">⚠️ Low Stock Items ({len(low_stock_items)})</h3>
            <table width="100%" style="border-collapse:collapse;margin-bottom:24px;border:1px solid #f1f5f9;border-radius:8px;overflow:hidden">
              <tr style="background:#fefce8">
                <th style="padding:8px 12px;text-align:left;font-size:0.75rem;color:#854d0e">Product</th>
                <th style="padding:8px 12px;text-align:left;font-size:0.75rem;color:#854d0e">Stock Qty</th>
              </tr>
              {low_stock_rows}
            </table>
            <h3 style="margin:0 0 12px;color:#dc2626;font-size:0.9rem;text-transform:uppercase">🚫 Out of Stock ({len(out_of_stock)})</h3>
            <table width="100%" style="border-collapse:collapse;margin-bottom:24px;border:1px solid #f1f5f9;border-radius:8px;overflow:hidden">
              <tr style="background:#fef2f2">
                <th style="padding:8px 12px;text-align:left;font-size:0.75rem;color:#dc2626">Product</th>
              </tr>
              {out_rows}
            </table>
            <p style="color:#94a3b8;font-size:0.75rem;text-align:center;margin:0">
              © {datetime.now().year} Jemariell General Merchandising Inc. · Auto-generated weekly report
            </p>
          </div>
        </div>
        """

        send_email(EMAIL_RECIPIENT, f"📦 Weekly Inventory Report — {week_str}", html)
        print(f"[WEEKLY REPORT] Sent to {EMAIL_RECIPIENT} on {week_str}")

    except Exception as e:
        print(f"[WEEKLY REPORT ERROR] {e}")


def _start_weekly_scheduler():
    """Runs every 30 min, fires report once per week on Monday at 8 AM."""
    last_sent_week = None
    while True:
        now          = datetime.now()
        current_week = now.isocalendar()[1]
        if now.weekday() == 0 and now.hour == 8 and last_sent_week != current_week:
            _weekly_report_job()
            last_sent_week = current_week
        time.sleep(1800)


_scheduler_thread = threading.Thread(target=_start_weekly_scheduler, daemon=True)
_scheduler_thread.start()
print("[SCHEDULER] Weekly email report scheduler started.")


# ==========================================
# 13. [API] MANUAL WEEKLY REPORT TRIGGER
# ==========================================
@app.route("/api/report/send-weekly", methods=["POST", "OPTIONS"])
def trigger_weekly_report():
    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200
    try:
        t = threading.Thread(target=_weekly_report_job, daemon=True)
        t.start()
        return jsonify({"success": True, "message": f"Weekly report is being sent to {EMAIL_RECIPIENT}."}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# ==========================================
# 14. RUN SERVER
# ==========================================
if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=False)