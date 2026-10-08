import os

from web3 import Web3
from dotenv import load_dotenv


# Find .env

BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

ENV_FILE = os.path.join(
    BASE_DIR,
    ".env"
)


load_dotenv(
    ENV_FILE,
    override=True
)


rpc_url = os.getenv(
    "SEPOLIA_RPC_URL"
)


if not rpc_url:

    raise ValueError(
        "SEPOLIA_RPC_URL is missing from .env"
    )


web3 = Web3(
    Web3.HTTPProvider(
        rpc_url
    )
)


def is_connected():

    return web3.is_connected()


def get_transaction(tx_hash):

    transaction = (
        web3.eth.get_transaction(
            tx_hash
        )
    )


    receipt = (
        web3.eth.get_transaction_receipt(
            tx_hash
        )
    )


    if receipt.status == 1:

        status = "CONFIRMED"

    else:

        status = "FAILED"


    return {

        "hash":
            tx_hash,

        "block_number":
            receipt.blockNumber,

        "status":
            status,

        "from":
            transaction["from"],

        "to":
            transaction["to"]

    }
