from flask import Flask, render_template, request
import subprocess
import sys
import os

app = Flask(__name__)

@app.route('/')
def index():
    """Render the main HTML page."""
    return render_template('index.html')

@app.route('/run', methods=['POST'])
def run_script():
    """Run the odoo-model-explorer.py script with provided arguments."""
    url = request.form.get('url')
    db = request.form.get('db')
    username = request.form.get('username')
    password = request.form.get('password')
    option = request.form.get('option')
    model_name = request.form.get('model_name', '')

    command = [sys.executable, 'odoo-model-explorer.py', '--url', url]
    if db:
        command.extend(['--db', db])
    if username:
        command.extend(['--username', username])
    if password:
        command.extend(['--password', password])
    command.extend(['--interactive'])

    model_required = {'3', '4', '5', '7', '10', '12', '13', '14', '15', '18'}
    if option in model_required and not model_name:
        return render_template('index.html', output="Error: Model name required for this option.")

    inputs = []
    inputs.append(option)
    if option == '2':
        inputs.append('hr')  # Default search term
    elif option in model_required:
        inputs.append(model_name)
    if option in {'9', '10', '11', '13', '14', '15', '18'}:
        inputs.append('')  # Default output file as empty (uses script defaults)
    inputs.append('')  # Enter to continue (or exit in non-interactive)

    try:
        result = subprocess.run(
            command,
            input='\n'.join(inputs),
            text=True,
            capture_output=True,
            check=True,
            timeout=60
        )
        output = result.stdout + result.stderr
    except subprocess.CalledProcessError as e:
        output = f"Error: {e.stderr}"
    except subprocess.TimeoutExpired:
        output = "Error: Script timed out after 60 seconds."
    except Exception as e:
        output = f"Unexpected error: {str(e)}"

    return render_template('index.html', output=output)

if __name__ == '__main__':
    os.makedirs('templates', exist_ok=True)
    app.run(debug=True, host='127.0.0.1', port=5000)