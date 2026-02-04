#!/usr/bin/env python3
"""HTTPS Server for QR Scanner - enables camera access on mobile"""
import http.server
import ssl
import os

PORT = 8443
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

# Create SSL context
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(
    os.path.join(DIRECTORY, 'cert.pem'),
    os.path.join(DIRECTORY, 'key.pem')
)

# Start server
server = http.server.HTTPServer(('0.0.0.0', PORT), Handler)
server.socket = context.wrap_socket(server.socket, server_side=True)

print(f"""
🔒 HTTPS Server running!

📱 On your phone, open:
   https://10.10.158.64:{PORT}

⚠️  You'll see a security warning - tap "Advanced" then "Proceed anyway"
   (This is normal for self-signed certificates)

🎥 Camera access will now work!

Press Ctrl+C to stop.
""")

server.serve_forever()
