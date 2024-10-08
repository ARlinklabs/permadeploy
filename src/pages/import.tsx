import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowLeft, Github, GitBranch, Search } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"
import axios from "axios"
import { useRouter } from "next/router"
import { BUILDER_BACKEND } from "@/lib/utils"
import { toast } from "sonner";
import Layout from "@/components/layout"

export default function GitHubImport() {
    const [userRepos, setUserRepos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isAppInstalled, setIsAppInstalled] = useState(false);
    const [installationId, setInstallationId] = useState("");
    const router = useRouter();

    useEffect(() => {
        checkInstallation();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function checkInstallation() {
        try {
            const response = await axios.get(`${BUILDER_BACKEND}/github/installation`);
            setIsAppInstalled(response.data.installed);
            if (response.data.installed) {
                setInstallationId(response.data.installationId);
                await fetchUserRepos();
            }
        } catch (error) {
            console.error("Error checking app installation:", error);
            setIsAppInstalled(false);
        }
    }

    async function fetchUserRepos() {
        setLoading(true);
        try {
            const response = await axios.get(`${BUILDER_BACKEND}/github/repos`);
            setUserRepos(response.data.repositories || []);
        } catch (error) {
            toast.error("Failed to fetch repositories");
        } finally {
            setLoading(false);
        }
    }

    const handleImport = (repoFullName: string) => {
        router.push(`/deploy?repo=${repoFullName}&installationId=${installationId}`);
    };

    const installGitHubApp = () => {
        window.location.href = `${BUILDER_BACKEND}/github/install`;
    };

    return (
        <Layout>
            <div className="flex flex-col min-h-screen bg-neutral-800 text-gray-100">
                <main className="flex-1 flex">
                    <div className="flex-1 p-6 dark:bg-neutral-900">
                        {!isAppInstalled ? (
                            <Button onClick={installGitHubApp}>Install GitHub App</Button>
                        ) : (
                            <>
                                <h1 className="text-2xl font-bold mb-6 text-gray-100">Select a GitHub Repository</h1>
                                <ScrollArea className="max-h-[500px] border rounded-md p-4">
                                    {loading ? (
                                        <div>Loading...</div>
                                    ) : (
                                        userRepos.map((repo: any) => (
                                            <div key={repo.id} className="flex justify-between items-center mb-2">
                                                <span>{repo.full_name}</span>
                                                <Button onClick={() => handleImport(repo.full_name)}>Import</Button>
                                            </div>
                                        ))
                                    )}
                                </ScrollArea>
                            </>
                        )}
                    </div>
                </main>
            </div>
        </Layout>

    )
}