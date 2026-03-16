let recognition: any = null
let silenceTimer: any = null

export function startListening(
  onTranscript: (text: string) => void,
  onCommand: (text: string) => void,
): boolean {
  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

  if (!SpeechRecognition) {
    console.error("SpeechRecognition API is not available in this environment.")
    onTranscript("Speech recognition is not available in this environment.")
    return false
  }

  recognition = new SpeechRecognition()

  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = "en-US"

  let finalTranscript = ""

  recognition.onresult = (event: any) => {
    let interimTranscript = ""

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript

      if (event.results[i].isFinal) {
        finalTranscript += transcript + " "
      } else {
        interimTranscript += transcript
      }
    }

    const combined = finalTranscript + interimTranscript
    onTranscript(combined)

    resetSilenceTimer(combined, onCommand)
  }

  recognition.onstart = () => {
    console.log("Speech recognition started")
  }

  recognition.onerror = (event: any) => {
    console.error("Speech error", event)
  }

  recognition.onend = () => {
    console.log("Speech recognition ended")
  }

  recognition.start()
  return true
}

function resetSilenceTimer(text: string, onCommand: (text: string) => void) {
  if (silenceTimer) clearTimeout(silenceTimer)

  silenceTimer = setTimeout(() => {
    if (text.trim().length > 0) {
      onCommand(text.trim())
    }
  }, 5000)
}

export function stopListening(onCommand: (text: string) => void, text: string) {
  if (recognition) {
    recognition.stop()
  }

  if (text.trim()) {
    onCommand(text.trim())
  }
}

export async function requestMicPermission() {
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true })
    return true
  } catch (err) {
    console.error("Mic permission denied", err)
    return false
  }
}