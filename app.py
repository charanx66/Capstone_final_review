"""Launch with python app.py, then visit http://127.0.0.1:8000."""
import json
from pathlib import Path
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlsplit, parse_qs
from benchmark import run


class Dashboard(BaseHTTPRequestHandler):
    def do_GET(self):
        url = urlsplit(self.path)
        try:
            if url.path == "/":
                data = Path(__file__).with_name("index.html").read_bytes()
                mime = "text/html; charset=utf-8"
            elif url.path == "/run":
                q = {k: v[-1] for k,v in parse_qs(url.query).items()}
                result = run(int(q.get("d",20)), int(q.get("active",5)), int(q.get("budget",40)),
                             int(q.get("seed",7)),float(q.get("noise",0)),q.get("constrained")=="on",
                             q.get("objective","Sphere"))
                data, mime = json.dumps(result, allow_nan=False).encode(), "application/json"
            else:
                return self.send_error(404)
        except (ValueError, OverflowError) as e:
            return self.send_error(400, str(e))
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    print("Open http://127.0.0.1:8000 in your browser", flush=True)
    HTTPServer(("127.0.0.1",8000),Dashboard).serve_forever()
