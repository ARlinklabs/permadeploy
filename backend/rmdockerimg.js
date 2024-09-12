import Docker from 'dockerode';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

async function removeDanglingImages() {
    try {
        const images = await docker.listImages({ filters: { dangling: ['true'] } });
        for (const image of images) {
            const imageId = image.Id;
            const imageInfo = await docker.getImage(imageId).inspect();
            const imageRepoTags = imageInfo.RepoTags || [];

            // Check if the image is the 'node' image
            const isNodeImage = imageRepoTags.some(tag => tag.startsWith('node'));

            if (!isNodeImage) {
                await docker.getImage(imageId).remove();
                console.log(`Image ${imageId} removed successfully`);
            } else {
                console.log(`Skipping removal of 'node' image: ${imageId}`);
            }
        }
    } catch (err) {
        console.error('Error removing images:', err);
    }
}

export default removeDanglingImages;