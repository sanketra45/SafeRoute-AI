# -*- coding: utf-8 -*-
"""Fix double CRLF in the patched section of ml_service.py"""
path = r'MlService\ml_service.py'
content = open(path, 'r', encoding='utf-8').read()
# Remove double carriage returns (artifacts of the patch)
fixed = content.replace('\r\r\n', '\r\n')
open(path, 'w', encoding='utf-8').write(fixed)
count = content.count('\r\r\n')
print(f"Fixed {count} double-CRLF sequences. Done.")
