#!/usr/bin/env node

import express from "express";
import cors from "cors";
import dockerode from "dockerode";
import fs from "fs";
import Irys from "@irys/sdk";
import { createClient } from "redis";
import { App } from "@octokit/app";
import { createNodeMiddleware } from "@octokit/webhooks";
import dotenv from "dotenv";
import {getItem, setItem} from "./storage.js";

dotenv.config();

const PORT = 3001;

const githubApp = new App({
    appId: process.env.GITHUB_APP_ID,
    privateKey: process.env.GITHUB_PRIVATE_KEY,
    webhooks: {
        secret: process.env.GITHUB_WEBHOOK_SECRET,
    }
})

const MAX_CONTAINERS = 3;
let activeContainers = 0;

const redisClient = createClient();
redisClient.on("error", (err) => console.error("Redis Client Error", err));
(async () => {
    try {
        await redisClient.connect();
        console.log("Connected to Redis");
    } catch (err) {
        console.error("Failed to connect to Redis do you have redis installed????", err);
    }
})();

const app = express();
app.use(express.json());
app.use(cors());
app.use(createNodeMiddleware(githubApp));
app.use('/api/github/webhooks', createNodeMiddleware(githubApp));

export async function deployFolder(path) {
    console.log("Deploying folder at", path);

    //const jwk = JSON.parse(fs.readFileSync('./wallet.json', 'utf-8'));
    const irys = new Irys({ url: 'https://turbo.ardrive.io', token: 'arweave', key: jwk });
    irys.uploader.useChunking = false;

    const txResult = await irys.uploadFolder(path, {
        indexFile: 'index.html',
        interactivePreflight: false,
        logFunction: (log) => {
            console.log(log);
            fs.appendFileSync(`${path}/../log.txt`, log + '\n');
        }
    });

    if (fs.existsSync(`${path}/../out-errors.txt`)) {
        const errors = fs.readFileSync(`${path}/../out-errors.txt`, 'utf-8');
        console.log('Errors:', errors);
        fs.appendFileSync(`${path}/../log.txt`, errors + '\n');
        throw new Error(errors);
    } else {
        console.log('No errors found');
        console.log('Transaction ID:', txResult.id);
        return txResult.id;
    }
}

app.get('/', (req, res) => {
    res.send('<pre>permaDeploy Builder Running!</pre>');
});

app.get('/github/install', async (req, res) => {
    const installationUrl = `https://github.com/apps/${process.env.GITHUB_APP_NAME}/installations/new`;
    res.redirect(installationUrl);
})

app.get('/github/installation', async (req, res) => {
    const installationId = getItem('installation_id');
    if (!installationId) {
        return res.status(200).send({
            installed: false,
            message: 'Installation ID not found'
        });
    }
    res.send({ installed: true, installationId });
})

app.get('/github/callback', async (req, res) => {
    const { installation_id, setup_action } = req.query;

     //TODO store installation_id in database
    if (setup_action === 'install') {
        setItem('installation_id', installation_id);
        res.redirect('http://localhost:3000/import');
    } else if(setup_action === 'cancel') {
        res.status(400).send('Installation cancelled');
    } else if(setup_action === 'configure') {
        res.status(400).send('Installation configuration required');
    } else {
        res.status(400).send('Installation failed!!');
    }
})

app.get('/github/repos', async (req, res) => {
    const installationId = getItem('installation_id');
    if (!installationId) {
        return res.status(400).send('Installation ID not found');
    }

    try {
        const octokit = await githubApp.getInstallationOctokit(installationId);
        const { data } = await octokit.request('GET /installation/repositories', {
            headers: {
              'X-GitHub-Api-Version': '2022-11-28'
            }
          });
        if (!data.repositories || data.repositories.length === 0) {
            return res.status(404).json({ error: 'No repositories found for this installation' });
        }
        res.json({ repositories: data.repositories });
    } catch (error) {
        console.error('Error fetching repos:', error);
        res.status(500).json({error: 'Error fetching repos'});
    }
})

app.get('/github/repo-details/:owner/:repo', async (req, res) => {
    const installationId = getItem('installation_id');
    if (!installationId) {
        return res.status(400).send('Installation ID not found');
    }
    const owner = req.params.owner.trim();
    const repo = req.params.repo.trim();

    try {
        const octokit = await githubApp.getInstallationOctokit(installationId);
        const { data } = await octokit.request('GET /repos/{owner}/{repo}', {
            owner,
            repo,
            headers: {
                'X-GitHub-Api-Version': '2022-11-28'
            }
        });
        res.json(data);
    } catch (error) {
        console.error('Error fetching repo details:', error);
        res.status(500).send('Error fetching repo details: ' + error.message);
    }
});

app.get('/github/branches/:owner/:repo', async (req, res) => {
    const installationId = getItem('installation_id');
    if (!installationId) {
        return res.status(400).send('Installation ID not found');
    }
    const owner = req.params.owner.trim();
    const repo = req.params.repo.trim();
    
    try {
        const octokit = await githubApp.getInstallationOctokit(installationId);
        const { data } = await octokit.request('GET /repos/{owner}/{repo}/branches', {
            owner,
            repo,
            headers: {
                'X-GitHub-Api-Version': '2022-11-28'
            }
        });
        res.send(data);
    } catch (error) {
        res.status(500).send('Error fetching branches');
    }
})

app.post('/deploy', async (req, res) => {
    console.log('Request:', req.body);
    const { repository, installCommand, buildCommand, outputDir, branch } = req.body;

    if (!repository) return res.status(400).send('Repository is required');
    if (!installCommand) return res.status(400).send('Install Command is required');
    if (!buildCommand) return res.status(400).send('Build Command is required');
    if (!outputDir) return res.status(400).send('Output Directory is required');
    if (!branch) return res.status(400).send('Branch is required');

    const folderName = `${repository}`.replace(/\.git|\/$/, '').split('/').pop();
    console.log('Folder name:', folderName);

    if (activeContainers >= MAX_CONTAINERS) {
        await redisClient.rPush("deployQueue", JSON.stringify({ req: req.body, res: res }));
        console.log('Added to queue');
    } else {
        activeContainers++;
        handleDeployment({ req, res, folderName, repository, installCommand, buildCommand, outputDir, branch });
    }
});

async function handleDeployment({ req, res, folderName, repository, installCommand, buildCommand, outputDir, branch }) {
    if (!fs.existsSync(`./builds/${folderName}`)) {
        fs.rmSync(`./builds/${folderName}`, { recursive: true, force: true });
        fs.mkdirSync(`./builds/${folderName}`, { recursive: true });
    }
    fs.writeFileSync(`./builds/${folderName}/log.txt`, '');

    const docker = new dockerode({ socketPath: '/var/run/docker.sock' });

    await docker.pull('node');
    console.log('Pulled node image');

    const container = await docker.createContainer({
        Image: 'node',
        Cmd: ['sh'],
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
        OpenStdin: true,
        HostConfig: {
            Binds: [`${process.cwd()}/builds:/home/node/builds`]
        }
    });
    console.log('Created container');
    await container.start();

    var containerCommand = `cd /home/node;
    rm -rf /home/node/${folderName}/${outputDir};
    echo "" > /home/node/${folderName}/log.txt;
    git clone -b ${branch} ${repository} ${folderName};
    cd /home/node/${folderName};
    ${installCommand};
    ${buildCommand};
    cp -r /home/node/${folderName}/${outputDir} /home/node/builds/${folderName}`;

    if (installCommand.startsWith('pnpm')) {
        containerCommand = `npm i -g pnpm; ${containerCommand}`;
    } else if (installCommand.startsWith('yarn')) {
        containerCommand = `npm i -g yarn; ${containerCommand}`;
    }

    fs.rmSync(`./builds/${folderName}`, { recursive: true, force: true });
    fs.mkdirSync(`./builds/${folderName}`, { recursive: true });

    const exec = await container.exec({
        Cmd: ['sh', '-c', containerCommand],
        AttachStderr: true,
        AttachStdout: true,
        Tty: true
    });

    exec.start({
        hijack: true,
        stdin: true,
        Detach: false
    }, (err, stream) => {
        if (err) {
            console.log('Exec error:', err);
            return;
        }

        container.modem.demuxStream(stream, process.stdout, process.stderr);
        const fileStream = fs.createWriteStream(`./builds/${folderName}/log.txt`);
        container.modem.demuxStream(stream, fileStream, fileStream);

        stream.on('end', async (err) => {
            console.log('Exec end');
            await container.commit();
            if (!fs.existsSync(`./builds/${folderName}/${outputDir}/index.html`)) {
                res.status(500).send('index.html does not exist in build');
            } else {
                try {
                    const dres = await deployFolder(`./builds/${folderName}/${outputDir}`);
                    res.send(dres);
                } catch (e) {
                    res.status(400).send(e.message);
                }
            }

            await container.stop();
            await container.remove();
            activeContainers--;
            processQueue();
        });
    });
}

async function processQueue() {
    if (activeContainers < MAX_CONTAINERS) {
        const queueItem = await redisClient.lPop("deployQueue");
        if (queueItem) {
            const { req, res } = JSON.parse(queueItem);
            activeContainers++;
            const { repository, installCommand, buildCommand, outputDir, branch } = req;
            const folderName = `${repository}`.replace(/\.git|\/$/, '').split('/').pop();
            handleDeployment({ req, res, folderName, repository, installCommand, buildCommand, outputDir, branch });
        }
    }
}

githubApp.webhooks.on('push', async ({ octokit, payload }) => {
    if (payload.ref !== `refs/heads/${payload.repository.default_branch}`) {
        const { owner, name: repo } = payload.repository;
        const branch = payload.repository.default_branch;
        const installationId = payload.installation.id;

        try {
            const config = await getDeploymentConfig(octokit, owner, repo);

            if (!config) {
                console.error('No deployment config found for', owner, repo);
                return;
            }

            const deploymentData = {
                repository: `${owner}/${repo}`,
                installCommand: config.installCommand,
                buildCommand: config.buildCommand,
                outputDir: config.outputDir,
                branch,
                installationId,
            };

            const response = await fetch('http://localhost:3001/deploy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(deploymentData),
            });

            if (!response.ok) {
                console.error('Deployment failed:', await response.text());
            } else {
                console.log(`Deployment triggered for ${owner}/${repo}`);
            }

        } catch (error) {
            console.error('Error processing webhook:', error);
        }
    }
})

app.get('/logs/:folder', (req, res) => {
    const { folder } = req.params;
    try {
        const log = fs.readFileSync(`./builds/${folder}/log.txt`, 'utf-8');
        res.send(log);
    } catch (e) {
        res.status(200).send('Log not found');
    }
}); 

const server = app.listen(PORT, () => {
    console.log('Server is running on port ' + PORT);
});
server.setTimeout(60 * 60 * 1000);
server.keepAliveTimeout = 60 * 60 * 1000;