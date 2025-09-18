import json
import struct
import sys

def send_message(message):
    try:
        data = json.dumps(message).encode("utf-8")
        length = struct.pack("I", len(data))
        
        # バイナリデータを直接書き込み
        sys.stdout.buffer.write(length)
        sys.stdout.buffer.write(data)
        sys.stdout.buffer.flush()
        
        print(f"Message sent: {message}", file=sys.stderr)
    except Exception as e:
        print(f"Send error: {e}", file=sys.stderr)

def main():
    print("Commands: start, stop, quit", file=sys.stderr)
    
    while True:
        try:
            cmd = input(">> ").strip()
            
            if cmd == "start":
                send_message({"type": "start-recording"})
            elif cmd == "stop":
                send_message({"type": "stop-recording"})
            elif cmd == "quit":
                break
            else:
                print("Commands: start, stop, quit", file=sys.stderr)
                
        except KeyboardInterrupt:
            break

if __name__ == "__main__":
    main()