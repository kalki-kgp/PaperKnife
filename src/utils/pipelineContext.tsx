import { createContext, useContext, useState, ReactNode } from 'react'

interface PipelinedFile {
  buffer: Uint8Array
  name: string
}

interface PipelineContextType {
  pipelinedFile: PipelinedFile | null
  setPipelineFile: (file: PipelinedFile | null) => void
  consumePipelineFile: () => PipelinedFile | null
}

const PipelineContext = createContext<PipelineContextType | undefined>(undefined)

export function PipelineProvider({ children }: { children: ReactNode }) {
  const [pipelinedFile, setPipelinedFile] = useState<PipelinedFile | null>(null)

  const consumePipelineFile = () => {
    const file = pipelinedFile
    setPipelinedFile(null)
    return file
  }

  return (
    <PipelineContext.Provider value={{ pipelinedFile, setPipelineFile: setPipelinedFile, consumePipelineFile }}>
      {children}
    </PipelineContext.Provider>
  )
}

export function usePipeline() {
  const context = useContext(PipelineContext)
  if (context === undefined) {
    throw new Error('usePipeline must be used within a PipelineProvider')
  }
  return context
}
