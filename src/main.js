const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.resolve(process.cwd(), 'public')))

const execSyncCommand = (command, callback, cwd = process.cwd()) => {
    return new Promise((resolve) => {
        let chunks = ""
        try {
            const child =  exec(command, {cwd})
            child.stdout.on('data', function(chunk) {
                chunks += chunk
                callback({
                    data: chunk,
                    done: false
                })
            })
            child.stderr.on('data', function(chunk) {
                chunks += chunk
                callback({
                    data: chunk,
                    done: false
                })
            })
            child.stdout.on('end', function() {
                callback({
                    data: chunks,
                    done: true
                })
                resolve(true)
            });
            child.on('error', (error) => {
                chunks += error.toString()
                callback({
                    data: error.toString(),
                    done: true
                })
                resolve(false)
            });
        } catch(e) {
            console.log(e)
            chunks += e.toString()
            callback({
                data: e.toString(),
                done: true
            })
        }
    })
    
}

function updateVersion(cwd, dockerComposeName, imageUrl, version) {
    const fileName = path.join(cwd || process.cwd(), dockerComposeName);
    return new Promise(resolve => {
        fs.readFile(fileName, 'utf8', (err, content) => {
            if (err) {
                console.error('Error reading file:', err);
                resolve({
                    ok: false,
                    message: 'Error reading file'
                })
                return
            }
            const reg = new RegExp(`(image: "${imageUrl}:)[^"]*`);
            // const re = /(image: "registry.cn-zhangjiakou.aliyuncs.com\/wiz-en-image\/sound-clone-pc:)[^"]*/;
            const newImage = `$1${version}`;
    
            const updatedContent = content.replace(reg, newImage);
    
            fs.writeFile(fileName, updatedContent, (err) => {
                if (err) {
                    console.error('Error writing file:', err);
                    resolve({
                        ok: false,
                        message: 'Error writing file'
                    })
                    return
                }
                // console.log('File updated successfully!');
                resolve({
                    ok: true,
                    message: 'File updated successfully!'
                })
            });
        });
    })
    
}

async function execCommand(res, data) {
    const {isPull, imageUrl, version, dockerComposeName, cwd} = data
    
    const cmdStop = `docker-compose -f ${dockerComposeName} down`;
    const cmdStart = `docker-compose -f ${dockerComposeName} up -d`;

    try {
        let ok = false
        if(isPull) {
            const image = `${imageUrl}:${version}`;
            const cmdPull = `docker pull ${image}`;
            ok = await execSyncCommand(cmdPull, ({data, done}) => {
                if(!done) {
                    res.write(data)
                } else {
                    res.write(`[CMD]: ${cmdPull} Execution ends`)
                }
            }, cwd)
            if(!ok) return;
        } 
        ok = await execSyncCommand(cmdStop, ({data, done}) => {
            if(!done) {
                res.write(data)
            } else {
                res.write(`[CMD]: ${cmdStop} Execution ends`)
            }
        }, cwd)
        if(!ok) return;
        await execSyncCommand(cmdStart, ({data, done}) => {
            if(!done) {
                res.write(data)
            } else {
                res.write(`[CMD]: ${cmdStart} Execution ends`)
            }
        }, cwd)
        res.end()
    } catch(err) {
        res.end(err.toString())
    }
}

app.post('/exec/deploy', async(req, res) => {
    const data = req.body;
    let result = {
        ok: true
    }
    if(data.version) {
       result = await updateVersion(data.cwd, data.dockerComposeName, data.imageUrl, data.version);
    } 
    if(result.ok) {
        if(result.message)
            res.write(result.message);
        execCommand(res, data);
    } else {
        if(result.message)
            res.write(result.message);
        res.end()
    }
});
app.get('/exec/test', async(req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    await execSyncCommand('ping www.baidu.com', ({data, done}) => {
        if(done) {
            res.end()
        } else {
            res.write(data)
        }
    })
});

app.listen(8080, () => {
    console.log('Listening on port 8080');
});