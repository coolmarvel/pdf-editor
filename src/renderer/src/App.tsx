import { useEffect, useState } from 'react'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import { useEditor } from './store/editor'
import Landing from './components/Landing'
import LoadingScreen from './components/LoadingScreen'
import Editor from './components/Editor'

export default function App(): JSX.Element {
  const phase = useEditor((s) => s.phase)
  const [recovered, setRecovered] = useState(false)

  useEffect(() => {
    window.api.onRecovered(() => setRecovered(true))
  }, [])

  return (
    <>
      {phase === 'landing' && <Landing />}
      {phase === 'loading' && <LoadingScreen />}
      {phase === 'editor' && <Editor />}
      <Snackbar open={recovered} autoHideDuration={8000} onClose={() => setRecovered(false)}>
        <Alert severity="warning" onClose={() => setRecovered(false)}>
          메모리 부족으로 화면을 복구했습니다. 작업 내용이 사라졌다면 파일을 다시 열어 주세요.
        </Alert>
      </Snackbar>
    </>
  )
}
