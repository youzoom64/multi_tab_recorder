import asyncio
import websockets
import json
import sys
import threading

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

clients = set()

async def handle_client(websocket, path):
    clients.add(websocket)
    print(f"Client connected from {websocket.remote_address}. Total clients: {len(clients)}")
    try:
        await websocket.wait_closed()
    except Exception as e:
        print(f"Error: {e}")
    finally:
        clients.discard(websocket)
        print(f"Client disconnected. Remaining clients: {len(clients)}")

async def send_command(command_type):
    if clients:
        message = json.dumps({"type": command_type})
        disconnected = []
        
        for client in clients:
            try:
                await client.send(message)
            except websockets.exceptions.ConnectionClosed:
                disconnected.append(client)
        
        for client in disconnected:
            clients.discard(client)
            
        print(f"[SEND] {message}")
    else:
        print("[WARN] No clients connected")

def input_thread(loop):
    """別スレッドでコマンド入力を処理"""
    print("Commands: start, stop, quit")
    while True:
        try:
            cmd = input(">> ").strip()
            if cmd == "start":
                asyncio.run_coroutine_threadsafe(send_command("start-recording"), loop)
            elif cmd == "stop":
                asyncio.run_coroutine_threadsafe(send_command("stop-recording"), loop)
            elif cmd == "quit":
                break
        except KeyboardInterrupt:
            break

async def main():
    print("Starting WebSocket server on localhost:8799")
    loop = asyncio.get_event_loop()
    
    # 入力用スレッドを開始
    thread = threading.Thread(target=input_thread, args=(loop,))
    thread.daemon = True
    thread.start()
    
    async with websockets.serve(handle_client, "localhost", 8799):
        print("Server running. Press Ctrl+C to stop.")
        await asyncio.Future()  # 永続的に動作

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Server stopped")