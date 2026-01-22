import { Navigate, Route, Routes } from 'react-router-dom'
import { InsightsView } from './components/insights/InsightsView'
import { Layout } from './components/layout/Layout'
import { PipelineView } from './components/pipeline/PipelineView'
import { ApiSettings } from './components/settings/ApiSettings'
import { UploadView } from './components/upload/UploadView'
import { ConfigProvider } from './hooks/useApiConfig'

export default function App() {
  return (
    <ConfigProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/upload" replace />} />
          <Route path="upload" element={<UploadView />} />
          <Route path="pipeline" element={<PipelineView />} />
          <Route path="insights" element={<InsightsView />} />
          <Route path="settings" element={<ApiSettings />} />
        </Route>
      </Routes>
    </ConfigProvider>
  )
}
