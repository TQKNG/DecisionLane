from __future__ import annotations

from azure.communication.email import EmailClient
from azure.core.credentials import TokenCredential


class StatusEmailService:
    def __init__(self, endpoint:str, sender:str, credential:TokenCredential)->None:
        self._client = EmailClient(endpoint, credential)
        self._sender = sender

    def send(self, recipient: str, claim_id:str, claim_status:str )-> None:
        message = {
            "senderAddress": self._sender,
            "recipients": {"to":[{"address":recipient}]},
            "content":{
                "subject": f"Refund claim {claim_id} update",
                "plainText": f"Your refund claim status is now {claim_status}.",
                "html":(
                     f"<p>Your refund claim <strong>{claim_id}</strong> "
                    f"is now <strong>{claim_status}</strong>.</p>"
                )
            }
        }
        poller = self._client.begin_send(message)
        poller.result()

