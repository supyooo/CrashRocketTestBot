"""Local server for the brand kit: serves the project and saves rendered PNG/GIF files.

POST /save?name=<file> with the raw image bytes writes brand/out/<file>.
Run from the project root:  python brand/serve.py 5174
"""
import http.server
import os
import re
import sys
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "brand", "out")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_POST(self):
        url = urllib.parse.urlparse(self.path)
        name = urllib.parse.parse_qs(url.query).get("name", [""])[0]
        if url.path != "/save" or not re.fullmatch(r"[\w.-]+\.(png|gif|svg|webp)", name):
            self.send_error(400, "expected /save?name=<file>.png|gif|svg|webp")
            return
        size = int(self.headers.get("Content-Length", 0))
        os.makedirs(OUT, exist_ok=True)
        with open(os.path.join(OUT, name), "wb") as f:
            f.write(self.rfile.read(size))
        self.send_response(204)
        self.end_headers()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5174
    http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
