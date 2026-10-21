#!/usr/bin/env python3
"""Serve the mirror locally while mapping its GitHub Pages base path to /."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, urlunsplit

BASE_PATH = "/deedee-studio-static"


class MirrorHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        parsed = urlsplit(path)
        pathname = parsed.path
        if pathname == BASE_PATH:
            pathname = "/"
        elif pathname.startswith(BASE_PATH + "/"):
            pathname = pathname[len(BASE_PATH):]
        rewritten = urlunsplit(("", "", pathname, parsed.query, parsed.fragment))
        return super().translate_path(rewritten)


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 4173), MirrorHandler).serve_forever()
