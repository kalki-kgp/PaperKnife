import React from 'react'
import ToolHeader from './ToolHeader'

interface NativeToolLayoutProps {
  title: string
  description: string
  children: React.ReactNode
  actions?: React.ReactNode
  onBack?: () => void
}

export const NativeToolLayout = ({
  title,
  description,
  children,
  actions,
}: NativeToolLayoutProps) => {
  return (
    <div className="flex flex-col min-h-screen bg-[#FFF3F0] dark:bg-black transition-colors">
      <main className={`flex-1 flex flex-col p-4 md:p-8 max-w-5xl mx-auto w-full ${actions ? 'pb-32 md:pb-8' : ''}`}>
        <div className="mb-8">
           <ToolHeader title={title} description={description} />
        </div>

        <div className="flex-1">
          {children}
        </div>
      </main>

      {actions && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-black/95 backdrop-blur-xl border-t border-gray-100 dark:border-white/5 z-40 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
           <div className="p-4 max-w-md mx-auto">
             {actions}
           </div>
        </div>
      )}
    </div>
  )
}
