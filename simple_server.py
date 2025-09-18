import asyncio
import websockets
import json
import sys

# Windows互換性を強制
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

async def handle_client(websocket, path):
    print(f"Client connected from {websocket.remote_address}")
    try:
        await websocket.wait_closed()
    except Exception as e:
        print(f"Error: {e}")
    finally:
        print("Client disconnected")

async def main():
    print("Starting WebSocket server on localhost:8799")
    async with websockets.serve(handle_client, "localhost", 8799):
        print("Server running. Press Ctrl+C to stop.")
        await asyncio.Future()  # 無限待機

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Server stopped")