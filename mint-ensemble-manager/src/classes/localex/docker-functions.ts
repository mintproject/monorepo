import Dockerode = require("dockerode")
import { imageExists, containerExec, pullImageAsync, waitForOutput } from 'dockerode-utils';

let dockerode = new Dockerode();

export const pullImage = async (image: string, version:string ="latest") => {
    let exists = await imageExists(dockerode, image);
    if(!exists) {
        console.log("Pulling docker image: "+ image);
        await pullImageAsync(dockerode, image);
    }
}

export const runImage = async (cmd: string[], image: string, logstream:any, 
        workingDirectory: string, folderBindings: string[] ) => {
    return dockerode.run(image, cmd, logstream, {
        'WorkingDir': workingDirectory,
        'Binds': folderBindings,
        'EntryPoint': "",
        'User': "1000:1000"
    });
}
