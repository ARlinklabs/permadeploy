import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowLeft, Github, GitBranch, Search } from "lucide-react"
import Link from "next/link"

export default function Component() {
  return (
    <div className="flex flex-col min-h-screen bg-neutral-800 text-gray-100">
      <main className="flex-1 flex">
        <div className="w-72 border-r border-gray-800 p-4 hidden md:block dark:bg-neutral-900">
          <h2 className="font-semibold mb-4 text-gray-100">Import Repository</h2>
          <nav className="space-y-2">
            <Link
              className="flex items-center space-x-2 text-blue-400 hover:text-blue-300"
              href="#"
            >
              <Github className="h-5 w-5" />
              <span>GitHub</span>
            </Link>
            <div className="flex items-center space-x-2 text-gray-500 cursor-not-allowed">
              <GitBranch className="h-5 w-5" />
              <span>Protocol land</span>
              <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded-full ml-aut border border-green-400">Coming Soon</span>
            </div>
          </nav>
        </div>
        <div className="flex-1 p-6 dark:bg-neutral-900">
          <h1 className="text-2xl font-bold mb-6 text-gray-100">Select a GitHub Repository</h1>
          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="border border-gray-700 rounded-lg p-4 hover:border-blue-500 transition-colors bg-transparent"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-100">Repository {i + 1}</h3>
                      <p className="text-sm text-gray-400">
                        github.com/user/repo-{i + 1}
                      </p>
                    </div>
                    <Button size="sm" className="bg-white hover:bg-[#CCCCCC] text-black cursor-pointer">Import</Button>
                  </div>
                  <div className="text-sm text-gray-400 mt-2">
                    Last updated 2 days ago
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </main>
    </div>
  )
}