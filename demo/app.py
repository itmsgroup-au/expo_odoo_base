import os
import json
import requests
import base64
from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify
from functools import wraps

app = Flask(__name__)
app.secret_key = os.urandom(24)

# Odoo API Configuration
ODOO_URL = "http://localhost:8069"
ODOO_DB = "loneworker"
ODOO_USERNAME = "mark"
ODOO_PASSWORD = "mark"

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in' not in session:
            flash('Please log in first', 'danger')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def get_auth_header():
    credentials = f"{session.get('username', ODOO_USERNAME)}:{session.get('password', ODOO_PASSWORD)}"
    encoded_credentials = base64.b64encode(credentials.encode()).decode()
    return {'Authorization': f'Basic {encoded_credentials}'}

def odoo_request(endpoint, method='GET', params=None, data=None):
    """Make request to Odoo API with proper headers and error handling"""
    url = f"{ODOO_URL}/api/v2/{endpoint}"
    headers = get_auth_header()
    headers['Content-Type'] = 'application/json'
    
    try:
        if method == 'GET':
            response = requests.get(url, headers=headers, params=params)
        elif method == 'POST':
            response = requests.post(url, headers=headers, params=params)
        elif method == 'PUT':
            response = requests.put(url, headers=headers, params=params)
        elif method == 'DELETE':
            response = requests.delete(url, headers=headers, params=params)
        
        # Print debug info in development
        if app.debug:
            print(f"API {method} {url}")
            print(f"Headers: {headers}")
            print(f"Params: {params}")
            print(f"Status: {response.status_code}")
            print(f"Response: {response.text[:200]}")
        
        if response.status_code != 200:
            flash(f"API Error: {response.status_code} - {response.text}", 'danger')
            return None
            
        return response.json()
    except Exception as e:
        flash(f"API Error: {str(e)}", 'danger')
        return None

@app.route('/')
def index():
    if 'logged_in' in session:
        return redirect(url_for('partners'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        # Test connection
        credentials = f"{username}:{password}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()
        headers = {
            'Authorization': f'Basic {encoded_credentials}',
            'Content-Type': 'application/json'
        }
        
        try:
            response = requests.get(f"{ODOO_URL}/api/v2/session", headers=headers)
            if response.status_code == 200:
                session['logged_in'] = True
                session['username'] = username
                session['password'] = password
                session['user_info'] = response.json()
                flash('Login successful', 'success')
                return redirect(url_for('partners'))
            else:
                flash('Login failed. Please check your credentials.', 'danger')
        except requests.exceptions.RequestException as e:
            flash(f'Could not connect to the Odoo server: {str(e)}', 'danger')
            
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    flash('Logged out successfully', 'success')
    return redirect(url_for('login'))

@app.route('/partners')
@login_required
def partners():
    page = request.args.get('page', 1, type=int)
    limit = 10
    offset = (page - 1) * limit
    
    # Get partners with pagination
    params = {
        'domain': json.dumps([('active', '=', True)]),  # Only active partners
        'fields': json.dumps(['name', 'email', 'phone', 'mobile', 'image_128', 'is_company', 'parent_id']),
        'limit': limit,
        'offset': offset,
    }
    
    partners = odoo_request('search_read/res.partner', params=params)
    
    # Get total count for pagination
    count_params = {
        'domain': json.dumps([('active', '=', True)]),  # Only active partners
        'count': True
    }
    count_result = odoo_request('search/res.partner', params=count_params)
    total_partners = count_result if count_result is not None else 0
    total_pages = (total_partners + limit - 1) // limit
    
    return render_template(
        'partners.html', 
        partners=partners, 
        page=page, 
        total_pages=total_pages, 
        total_partners=total_partners
    )

@app.route('/partners/create', methods=['GET', 'POST'])
@login_required
def create_partner():
    if request.method == 'POST':
        # Gather form data
        values = {
            'name': request.form.get('name'),
            'email': request.form.get('email'),
            'phone': request.form.get('phone'),
            'mobile': request.form.get('mobile'),
            'street': request.form.get('street'),
            'city': request.form.get('city'),
            'is_company': 'is_company' in request.form,
        }
        
        # Remove empty values
        values = {k: v for k, v in values.items() if v}
        
        # Create partner
        params = {
            'values': json.dumps(values)
        }
        
        # Debug info
        if app.debug:
            print(f"Create params: {params}")
        
        result = odoo_request('create/res.partner', method='POST', params=params)
        
        if result:
            flash('Partner created successfully', 'success')
            return redirect(url_for('partners'))
        
    return render_template('partner_form.html', partner=None)

@app.route('/partners/<int:partner_id>')
@login_required
def view_partner(partner_id):
    params = {
        'ids': json.dumps([partner_id]),
        'fields': json.dumps([
            'name', 'email', 'phone', 'mobile', 'image_1920',
            'street', 'street2', 'city', 'state_id', 'zip', 'country_id',
            'is_company', 'parent_id', 'child_ids', 'category_id',
            'comment', 'website', 'active'
        ])
    }
    
    partners = odoo_request('read/res.partner', params=params)
    
    if not partners or not partners[0]:
        flash('Partner not found', 'danger')
        return redirect(url_for('partners'))
    
    return render_template('partner_detail.html', partner=partners[0])

@app.route('/partners/<int:partner_id>/edit', methods=['GET', 'POST'])
@login_required
def edit_partner(partner_id):
    if request.method == 'POST':
        # Gather form data
        values = {
            'name': request.form.get('name'),
            'email': request.form.get('email'),
            'phone': request.form.get('phone'),
            'mobile': request.form.get('mobile'),
            'street': request.form.get('street'),
            'city': request.form.get('city'),
            'is_company': 'is_company' in request.form,
        }
        
        # Remove empty values (None or empty string)
        values = {k: v for k, v in values.items() if v is not None and v != ""}
        
        # Update partner - proper formatting
        params = {
            'ids': json.dumps([partner_id]),
            'values': json.dumps(values)
        }
        
        # Debug info
        if app.debug:
            print(f"Update params: {params}")
        
        result = odoo_request('write/res.partner', method='PUT', params=params)
        
        if result:
            flash('Partner updated successfully', 'success')
            return redirect(url_for('view_partner', partner_id=partner_id))
    
    # Get partner data for edit form
    params = {
        'ids': json.dumps([partner_id]),
        'fields': json.dumps([
            'name', 'email', 'phone', 'mobile', 'image_128',
            'street', 'street2', 'city', 'state_id', 'zip', 'country_id',
            'is_company', 'parent_id'
        ])
    }
    
    partners = odoo_request('read/res.partner', params=params)
    
    if not partners or not partners[0]:
        flash('Partner not found', 'danger')
        return redirect(url_for('partners'))
    
    return render_template('partner_form.html', partner=partners[0])

@app.route('/partners/<int:partner_id>/delete', methods=['POST'])
@login_required
def delete_partner(partner_id):
    # Archive instead of delete (set active=false)
    params = {
        'ids': json.dumps([partner_id]),
        'values': json.dumps({'active': False})
    }
    
    # Debug info
    if app.debug:
        print(f"Archive params: {params}")
    
    result = odoo_request('write/res.partner', method='PUT', params=params)
    
    if result:
        flash('Partner archived successfully', 'success')
    else:
        # Try direct delete if archive fails
        params = {
            'ids': json.dumps([partner_id])
        }
        result = odoo_request('unlink/res.partner', method='DELETE', params=params)
        if result:
            flash('Partner deleted successfully', 'success')
    
    return redirect(url_for('partners'))

@app.route('/api/partners/search', methods=['GET'])
@login_required
def search_partners():
    search_term = request.args.get('term', '')
    
    params = {
        'domain': json.dumps([('name', 'ilike', search_term), ('active', '=', True)]),
        'fields': json.dumps(['name', 'email', 'phone']),
        'limit': 10
    }
    
    partners = odoo_request('search_read/res.partner', params=params)
    
    return jsonify(partners if partners else [])

@app.route('/archived-partners')
@login_required
def archived_partners():
    page = request.args.get('page', 1, type=int)
    limit = 10
    offset = (page - 1) * limit
    
    # Get archived partners with pagination
    params = {
        'domain': json.dumps([('active', '=', False)]),  # Only archived partners
        'fields': json.dumps(['name', 'email', 'phone', 'mobile', 'image_128', 'is_company', 'parent_id']),
        'limit': limit,
        'offset': offset,
    }
    
    partners = odoo_request('search_read/res.partner', params=params)
    
    # Get total count for pagination
    count_params = {
        'domain': json.dumps([('active', '=', False)]),  # Only archived partners
        'count': True
    }
    count_result = odoo_request('search/res.partner', params=count_params)
    total_partners = count_result if count_result is not None else 0
    total_pages = (total_partners + limit - 1) // limit
    
    return render_template(
        'archived_partners.html', 
        partners=partners, 
        page=page, 
        total_pages=total_pages, 
        total_partners=total_partners
    )

@app.route('/partners/<int:partner_id>/restore', methods=['POST'])
@login_required
def restore_partner(partner_id):
    # Restore archived partner (set active=true)
    params = {
        'ids': json.dumps([partner_id]),
        'values': json.dumps({'active': True})
    }
    
    # Debug info
    if app.debug:
        print(f"Restore params: {params}")
    
    result = odoo_request('write/res.partner', method='PUT', params=params)
    
    if result:
        flash('Partner restored successfully', 'success')
    
    return redirect(url_for('archived_partners'))

if __name__ == '__main__':
    app.run(debug=True)