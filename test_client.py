import asyncio
import websockets
import json
import sys

async def test_client():
    uri = "ws://localhost:8799"
    print(f"Connecting to {uri}...")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✓ Connected successfully!")
            
            # サーバーからのメッセージを受信するタスク
            async def receive_messages():
                try:
                    while True:
                        message = await websocket.recv()
                        data = json.loads(message)
                        print(f"Received: {data}")
                except websockets.exceptions.ConnectionClosed:
                    print("Connection closed by server")
            
            # メッセージ受信タスクを開始
            receive_task = asyncio.create_task(receive_messages())
            
            # 接続維持
            print("Connection established. Press Ctrl+C to exit.")
            try:
                await receive_task
            except asyncio.CancelledError:
                print("Client disconnected")
                
    except ConnectionRefusedError:
        print("✗ Connection refused - Server not running on port 8799")
    except Exception as e:
        print(f"✗ Connection failed: {e}")

if __name__ == "__main__":
    # Windows環境での互換性
    if sys.platform.startswith('win'):
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    try:
        asyncio.run(test_client())
    except KeyboardInterrupt:
        print("\nClient stopped")