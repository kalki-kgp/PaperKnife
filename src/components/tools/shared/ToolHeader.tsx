interface ToolHeaderProps {
  title: string
  highlight?: string
  description: string
}

export default function ToolHeader({ title, highlight, description }: ToolHeaderProps) {
  return (
    <div className="relative text-center mb-8 md:mb-12">
      <h2 className="text-3xl md:text-5xl font-black mb-3 md:mb-4 dark:text-white px-10">
        {title} <span className="text-terracotta-500">{highlight}.</span>
      </h2>
      <p className="text-sm md:text-base text-gray-500 dark:text-zinc-400 max-w-lg mx-auto leading-relaxed">
        {description}
      </p>
    </div>
  )
}
