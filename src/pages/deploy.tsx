import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGlobalState } from "@/hooks";
import { runLua } from "@/lib/ao-vars";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import Arweave from "arweave";
import { Loader } from "lucide-react";
import axios from "axios";
import Ansi from "ansi-to-react";
import { BUILDER_BACKEND } from "@/lib/utils";
import useDeploymentManager from "@/hooks/useDeploymentManager";

function Logs({ name, deploying }: { name: string, deploying?: boolean }) {
    console.log(name);
    const [output, setOutput] = useState("");

    useEffect(() => {
        if (!name) return;
        const interval: ReturnType<typeof setInterval> = setInterval(async () => {
            if (!deploying) return clearInterval(interval);
            const logs = await axios.get(`${BUILDER_BACKEND}/logs/${name}`);
            console.log(logs.data);
            setOutput((logs.data as string).replaceAll(/\\|\||\-/g, ""));
            setTimeout(() => {
                const logsDiv = document.getElementById("logs");
                logsDiv?.scrollTo({ top: logsDiv.scrollHeight, behavior: "smooth" });
            }, 100);
        }, 1000);

        return () => { clearInterval(interval); }
    }, [name, deploying]);

    return (
        <div>
            <div className="pl-2 mb-1">Build Logs</div>
            <pre className="font-mono text-xs border p-2 rounded-lg px-4 bg-black/30 overflow-scroll max-h-[250px]" id="logs">
                <Ansi className="!font-mono">{output}</Ansi>
            </pre>
        </div>
    );
}

export default function Deploy() {
    const router = useRouter();
    const globalState = useGlobalState();
    const { managerProcess, refresh } = useDeploymentManager();
    const [projName, setProjName] = useState("");
    const [repoUrl, setRepoUrl] = useState("");
    const [installCommand, setInstallCommand] = useState("npm install");
    const [buildCommand, setBuildCommand] = useState("npm run build");
    const [outputDir, setOutputDir] = useState("./dist");
    const [deploying, setDeploying] = useState(false);
    const [arnsProcess, setArnsProcess] = useState("");
    const [selectedBranch, setSelectedBranch] = useState("");
    const [branches, setBranches] = useState([]);
    const [loadingBranches, setLoadingBranches] = useState(false);
    const [branchError, setBranchError] = useState("");
    const [installationId, setInstallationId] = useState("");
    const [userRepos, setUserRepos] = useState([]);
    const [selectedRepo, setSelectedRepo] = useState("");
    const [isAppInstalled, setIsAppInstalled] = useState(false);

    useEffect(() => {
        checkInstallation();
        const handleFocus = () => {
            checkInstallation();
        }
        window.addEventListener("focus", handleFocus);
        return () => {
            window.removeEventListener("focus", handleFocus);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function checkInstallation() {
        try {
            const response = await axios.get(`${BUILDER_BACKEND}/github/installation`);
            console.log("Installation check response:", response.data);
            setIsAppInstalled(response.data.installed);
            if (response.data.installed) {
                setInstallationId(response.data.installationId);
                await fetchUserRepos();
            }
        } catch (error) {
            console.error("Error checking app insta llation:", error);
            setIsAppInstalled(false);
        }
    }

    async function installGitHubApp() {
        window.location.href = `${BUILDER_BACKEND}/github/install`;
    }

    async function fetchUserRepos() {
        try {
            const response = await axios.get(`${BUILDER_BACKEND}/github/repos`);
            setUserRepos(response.data.repositories || []);
        } catch (error) {
            console.error("Error fetching user repos:", error);
            toast.error("Failed to fetch repositories");
        }
    }
    // console.log("Render state:", { isAppInstalled, userRepos });

    async function fetchRepoDetails(repoFullName: string) {
        try {
            // console.log(`${repoFullName}`);
            const [owner, repo] = repoFullName.split("/");
            console.log(owner, repo);
            const response = await axios.get(`${BUILDER_BACKEND}/github/repo-details/${owner}/${repo}`);
            console.log("Repo details:", response.data);
            const { default_branch, buildCommand, installCommand, outputDir } = response.data;

            setSelectedBranch(default_branch);
            setBuildCommand(buildCommand || "npm run build");
            setInstallCommand(installCommand || "npm ci");
            setOutputDir(outputDir || "./dist");

            fetchBranches(repoFullName);
        } catch (error: any) {
            console.error("Error fetching repo details:", error);
            if (axios.isAxiosError(error)) {
                console.error("Response data:", error.response?.data);
                console.error("Status code:", error.response?.status);
            }
            toast.error(`Failed to fetch repository details: ${error.message}`);
        }
    }

    const arweave = Arweave.init({
        host: "arweave.net",
        port: 443,
        protocol: "https",
    });

    async function fetchBranches(repoFullName: string) {
        setLoadingBranches(true);
        setBranchError("");
        const [owner, repo] = repoFullName.split("/");
        try {
            const response = await axios.get(`${BUILDER_BACKEND}/github/branches/${owner}/${repo}`);
            console.log("Branches:", response.data);
            setBranches(response.data);
        } catch (error) {
            setBranchError("Failed to fetch branches");
            console.error(error);
        } finally {
            setLoadingBranches(false);
        }
    }

    async function deploy() {
        if (!projName) return toast.error("Project Name is required");
        if (!repoUrl) return toast.error("Repository Url is required");
        if (!selectedBranch) return toast.error("Branch is required");
        if (!installCommand) return toast.error("Install Command is required");
        if (!buildCommand) return toast.error("Build Command is required");
        if (!outputDir) return toast.error("Output Directory is required");
        if (!arnsProcess) return toast.error("ArNS Process ID is required");

        if (deploying) return;

        if (!globalState.managerProcess) return toast.error("Manager process not found");

        setDeploying(true);
        const query = `local res = db:exec[[
            INSERT INTO Deployments (Name, RepoUrl, Branch, InstallCMD, BuildCMD, OutputDIR, ArnsProcess)
                VALUES
            ('${projName}', '${repoUrl}', '${selectedBranch}', '${installCommand}', '${buildCommand}', '${outputDir}', '${arnsProcess}')
        ]]`;
        console.log(query);

        const res = await runLua(query, globalState.managerProcess);
        if (res.Error) return toast.error(res.Error);
        console.log(res);
        // await refresh();

        try {
            const txid = await axios.post(`${BUILDER_BACKEND}/deploy`, {
                repository: repoUrl,
                branch: selectedBranch,
                installCommand,
                buildCommand,
                outputDir,
                installationId,
            }, { timeout: 60 * 60 * 1000, headers: { "Content-Type": "application/json" } });

            if (txid.status === 200) {
                console.log("https://arweave.net/" + txid.data);
                toast.success("Deployment successful");

                const mres = await runLua("", arnsProcess, [
                    { name: "Action", value: "Set-Record" },
                    { name: "Sub-Domain", value: "@" },
                    { name: "Transaction-Id", value: txid.data },
                    { name: "TTL-Seconds", value: "3600" },
                ]);
                console.log("set arns name", mres);

                const updres = await runLua(`db:exec[[UPDATE Deployments SET DeploymentId='${txid.data}' WHERE Name='${projName}']]`, globalState.managerProcess);

                router.push("/deployments/" + projName);
                window.open("https://arweave.net/" + txid.data, "_blank");

            } else {
                toast.error("Deployment failed");
                console.log(txid);
            }
        } catch (error) {
            toast.error("Deployment failed");
            console.log(error);
        }

        setDeploying(false);
    }

    return (
        <Layout>
            <div className="text-xl my-5 mb-10">Create New Deployment</div>

            <div className="md:min-w-[60%] w-full max-w-lg mx-auto flex flex-col gap-2">
                {!isAppInstalled ? (
                    <Button onClick={installGitHubApp}>Install GitHub App</Button>
                ) : (
                    <>
                        <label className="text-muted-foreground pl-2 pt-2 -mb-1" htmlFor="project-name">Project Name</label>
                        <Input placeholder="e.g. Coolest AO App" id="project-name" required onChange={(e) => setProjName(e.target.value)} />

                        <label className="text-muted-foreground pl-2 pt-2 -mb-1" htmlFor="repo-select">Select Repository</label>

                        <select
                            className="border rounded-md p-2"
                            value={selectedRepo}
                            onChange={(e) => {
                                setSelectedRepo(e.target.value);
                                fetchRepoDetails(e.target.value);
                            }}
                        >
                            <option value="" disabled>Select a repository</option>
                            {userRepos.map((repo: any) => (
                                <option key={repo.id} value={repo.full_name}>
                                    {repo.full_name}
                                </option>
                            ))}
                        </select>
                        {selectedRepo && (
                            <>
                                <label className="text-muted-foreground pl-2 pt-2 -mb-1" htmlFor="branch">Branch</label>
                                <select
                                    className="border rounded-md p-2"
                                    value={selectedBranch}
                                    onChange={(e) => setSelectedBranch(e.target.value)}
                                    disabled={loadingBranches}
                                >
                                    <option value="" disabled>Select a branch</option>
                                    {branches.map((branch: any) => (
                                        <option key={branch.name} value={branch.name}>
                                            {branch.name}
                                        </option>
                                    ))}
                                </select>
                                {branchError && <div className="text-red-500">{branchError}</div>}

                                <label className="text-muted-foreground pl-2 pt-10 -mb-1" htmlFor="install-command">Install Command</label>
                                <Input value={installCommand} placeholder="e.g. npm ci" id="install-command" onChange={(e) => setInstallCommand(e.target.value)} />

                                <label className="text-muted-foreground pl-2 pt-2 -mb-1" htmlFor="build-command">Build Command</label>
                                <Input value={buildCommand} placeholder="e.g. npm run build" id="build-command" onChange={(e) => setBuildCommand(e.target.value)} />

                                <label className="text-muted-foreground pl-2 pt-2 -mb-1" htmlFor="output-dir">Output Directory</label>
                                <Input value={outputDir} placeholder="e.g. ./dist" id="output-dir" onChange={(e) => setOutputDir(e.target.value)} />

                                <Button className="w-full mt-10" variant="secondary" onClick={deploy}>
                                    {deploying ? <Loader className="animate-spin mr-2" /> : "Deploy"}
                                </Button>

                                {deploying && <Logs name={projName} deploying={deploying} />}
                            </>
                        )}
                    </>
                )}
            </div>
        </Layout>
    );
}
