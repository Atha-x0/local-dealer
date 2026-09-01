import base64
import json
import time
from nacl.signing import SigningKey
from nacl.encoding import Base64Encoder
import hashlib

def create_authorization_header(payload: dict, bap_id: str, unique_key_id: str, private_key_b64: str) -> str:
    """
    Creates the ONDC Authorization header for a given payload using Ed25519 cryptography.
    The private key should be base64 encoded.
    """
    try:
        # Load the signing key
        signing_key = SigningKey(private_key_b64.encode('utf-8'), encoder=Base64Encoder)
        
        # Prepare the data to be signed (JSON payload stringified with no spaces)
        payload_str = json.dumps(payload, separators=(',', ':'))
        
        created = int(time.time())
        expires = created + 3000  # valid for 50 mins
        
        # Hash the payload using BLAKE2b (ONDC requirement)
        digest = hashlib.blake2b(payload_str.encode('utf-8')).digest()
        digest_b64 = base64.b64encode(digest).decode('utf-8')
        
        # The string to sign
        signing_string = f"(created): {created}\n(expires): {expires}\ndigest: BLAKE-512={digest_b64}"
        
        # Sign it
        signature_bytes = signing_key.sign(signing_string.encode('utf-8')).signature
        signature_b64 = base64.b64encode(signature_bytes).decode('utf-8')
        
        # Construct the header
        key_id = f"{bap_id}|{unique_key_id}|ed25519"
        header = f'Signature keyId="{key_id}",algorithm="ed25519",created="{created}",expires="{expires}",headers="(created) (expires) digest",signature="{signature_b64}"'
        
        return header
    except Exception as e:
        print(f"Error creating ONDC signature: {e}")
        return ""

def generate_key_pair():
    """Generates a new Ed25519 key pair for development purposes."""
    signing_key = SigningKey.generate()
    private_key_b64 = signing_key.encode(encoder=Base64Encoder).decode('utf-8')
    public_key_b64 = signing_key.verify_key.encode(encoder=Base64Encoder).decode('utf-8')
    return private_key_b64, public_key_b64
