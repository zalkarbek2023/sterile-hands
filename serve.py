# Local server for Sterile Hands: static files + PUT /upload/<name> saves a tab recording into <root>/recordings/.
# Larger listen backlog: Python 3.9's default of 5 resets Chrome's parallel fetches.
import functools, http.server, os, re, sys

root, port = sys.argv[1], int(sys.argv[2])
NAME = re.compile(r"^sterile-hands-[\w-]+\.(mp4|webm|json)$")


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")  # always serve the latest app code while developing
        super().end_headers()

    def do_PUT(self):
        name = self.path.rsplit("/", 1)[-1]
        if not self.path.startswith("/upload/") or not NAME.match(name):
            self.send_error(400, "bad name")
            return
        n = int(self.headers.get("Content-Length", 0))
        os.makedirs(os.path.join(root, "recordings"), exist_ok=True)
        with open(os.path.join(root, "recordings", name), "wb") as f:
            left = n
            while left > 0:
                chunk = self.rfile.read(min(left, 1 << 20))
                if not chunk:
                    break
                f.write(chunk)
                left -= len(chunk)
        self.send_response(201)
        self.end_headers()
        print("saved", name, n, "bytes", flush=True)


class S(http.server.ThreadingHTTPServer):
    request_queue_size = 128


S(("127.0.0.1", port), functools.partial(Handler, directory=root)).serve_forever()
