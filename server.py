import json
from http.server import SimpleHTTPRequestHandler, HTTPServer

class CustomHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/env.json':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            api_key = ''
            try:
                with open('.env', 'r') as f:
                    for line in f:
                        if line.startswith('SKYMAVIS_API_KEY='):
                            api_key = line.strip().split('=', 1)[1]
                            break
            except Exception:
                pass
            self.wfile.write(json.dumps({'SKYMAVIS_API_KEY': api_key}).encode())
        else:
            super().do_GET()

if __name__ == '__main__':
    print("Starting local dev server on http://localhost:8080...")
    print("This server will provide your .env API key to the frontend.")
    server = HTTPServer(('localhost', 8080), CustomHandler)
    server.serve_forever()
