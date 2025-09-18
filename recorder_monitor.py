# -*- coding: utf-8 -*-
import json
import struct
import sys
import threading
from datetime import datetime

class RecorderMonitor:
    def __init__(self):
        pass
        
    def send_message(self, message):
        try:
            data = json.dumps(message).encode("utf-8")
            sys.stdout.buffer.write(struct.pack("I", len(data)))
            sys.stdout.buffer.write(data)
            sys.stdout.flush()
            print(f"[SEND] {message}", file=sys.stderr)
        except Exception as e:
            print(f"[ERROR] {e}", file=sys.stderr)
    
    def receive_messages(self):
        while True:
            try:
                raw_length = sys.stdin.buffer.read(4)
                if len(raw_length) == 0:
                    break
                message_length = struct.unpack('I', raw_length)[0]
                message = sys.stdin.buffer.read(message_length)
                data = json.loads(message.decode('utf-8'))
                print(f"[RECV] {data}", file=sys.stderr)
            except Exception as e:
                print(f"[RECV_ERROR] {e}", file=sys.stderr)
                break
    
    def open_and_record(self, url):
        self.send_message({
            "type": "open-and-record",
            "url": url
        })
    
    def stop_recording(self):
        self.send_message({
            "type": "stop-recording"
        })

def main():
    monitor = RecorderMonitor()
    
    receive_thread = threading.Thread(target=monitor.receive_messages, daemon=True)
    receive_thread.start()
    
    print("Commands: url <URL>, stop, quit", file=sys.stderr)
    
    while True:
        try:
            cmd = input(">> ").strip()
            
            if cmd.startswith("url "):
                url = cmd[4:]
                monitor.open_and_record(url)
            elif cmd == "stop":
                monitor.stop_recording()
            elif cmd == "quit":
                break
            else:
                print("Commands: url <URL>, stop, quit", file=sys.stderr)
                
        except KeyboardInterrupt:
            break

if __name__ == "__main__":
    main()