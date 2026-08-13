#!/bin/sh
# Browsers won't let a double-clicked page load model files from disk
# (they sandbox file://), so we serve the folder like a real website.
echo "→ open http://localhost:8000"
python3 -m http.server 8000
