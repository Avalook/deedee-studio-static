#!/bin/zsh
cd "${0:A:h}"
open 'http://127.0.0.1:4173'
python3 -m http.server 4173 --bind 127.0.0.1
