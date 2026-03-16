import { useState } from "react"
import { startListening, stopListening, requestMicPermission } from "../services/speech"

export default function VoiceCommander() {
    const [listening, setListening] = useState(false)
    const [transcript, setTranscript] = useState("")
    const [history, setHistory] = useState<string[]>([])

    function handleCommand(cmd: string) {
        setHistory((prev) => [cmd, ...prev])
        setTranscript("")
    }

    async function toggleMic() {
        if (!listening) {
            const allowed = await requestMicPermission()

            if (!allowed) {
                alert("Microphone permission required")
                return
            }

      const ok = startListening(setTranscript, handleCommand)
      if (!ok) {
        alert("Speech recognition is not available in this environment. Try using the web app in a supported browser.")
        return
      }
      setListening(true)
        } else {
            stopListening(handleCommand, transcript)
            setListening(false)
        }
    }

    return (
        <div>
            <div>{transcript || "Say a command..."}</div>

            <button onClick={toggleMic}>
                {listening ? "Stop Mic 🎤" : "Start Mic 🎤"}
            </button>

            <h3>Command History</h3>

            {history.map((cmd, i) => (
                <div key={i}>{cmd}</div>
            ))}
        </div>
    )
}