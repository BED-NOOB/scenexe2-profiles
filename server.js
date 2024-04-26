const express = require("express");
//const fetch = require("node-fetch");
import("node-fetch").then(fetch => {
}).catch(err => {
    console.error('Failed to load node-fetch:', err);
});
const fs = require("fs");
const https = require("https");
const crypto = require('crypto');
const session = require('express-session');
const { URLSearchParams } = require('url');
const { Console } = require("console");

const app = express();
const port = 3000;
const host = 'http://localhost'

const CLIENT_ID = '' //in discord dev app where you made Oauth2 get client id
const CLIENT_SECRET = '' //in discord dev app where you made Oauth2 get client secret token
const REDIRECT_URI = `${host}:${port}/callback` //callback address

let database = {};

fs.readFile('database.json', 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading database file:', err);
        return;
    }
    try {
        database = JSON.parse(data);
        console.log('Database loaded successfully');
    } catch (parseError) {
        console.error('Error parsing database JSON:', parseError);
    }
});

const generateRandomString = () => {
    return crypto.randomBytes(32).toString('hex');
  };
  
const secret = generateRandomString();

app.use(session({
    secret: secret,
    resave: false,
    saveUninitialized: false
}));

app.get('/link', (req, res) => {
    const authorizationUrl = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=identify`;
    res.redirect(authorizationUrl);
});

app.post('/database', express.json(), (req, res) => {
    const { user, discordId, discordAvatarLink } = req.body;

    if (!user || !discordId || !discordAvatarLink) {
        return res.status(400).json({ error: 'Missing fields' });
    }

    if (database[user]) {
        return res.status(409).json({ error: 'User already exists and cannot be changed' });
    }

    database[user] = [discordId, discordAvatarLink];
    res.status(201).json({ message: 'User data added' });
    const jsonData = JSON.stringify(database, null, 2);

    fs.writeFile('database.json', jsonData, (err) => {
        if (err) {
            console.error('Error writing to database file:', err);
        } else {
            console.log('Data written to database file successfully');
        }
    });
});

app.get('/database', (req, res) => {
    fs.readFile('database.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading database file:', err);
            return res.status(500).json({ error: 'Error reading database file' });
        }
        try {
            const database = JSON.parse(data);
            res.json(database);
        } catch (parseError) {
            console.error('Error parsing database JSON:', parseError);
            res.status(500).json({ error: 'Error parsing database JSON' });
        }
    });
});

app.get('/callback', async (req, res) => {
    const code = req.query.code;
    const tokenUrl = 'https://discord.com/api/oauth2/token';
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        scope: 'identify',
    });

    try {
        const tokenResponse = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params,
        });

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const userData = await userResponse.json();

        console.log("Retrieved user data:", userData);

        if (!req.session.userData) {
            req.session.userData = {};
        }

        req.session.userData.avatarUrl = `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`;

        console.log("User data after setting avatar URL:", req.session.userData);

        res.send(`
            <script>
                const userDataToSend = {
                    discordId: '${userData.id}',
                    discordAvatarLink: '${req.session.userData.avatarUrl}',
                };               //YOU NEED TO HARDCODE THIS ONE
                const database = 'http://localhost:3000/database';

                const enteredAccountName = prompt('Enter your scenexe2 account name (all lowercase):');
                if (enteredAccountName) {
                    userDataToSend.user = enteredAccountName;

                    fetch(database, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(userDataToSend),
                    })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Failed to add user data to the database');
                        }
                        return response.json();
                    })
                    .then(data => {
                        console.log('User data added to the database:', data);
                        window.location.href = '/account/' + encodeURIComponent(enteredAccountName);
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        alert('Error fetching user data');
                    });
                } else {
                    window.location.href = '/'; // Redirect back to homepage if no account name entered
                }
            </script>
        `);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error fetching user data');
    }
});

app.get("/account/:user", async (req, res) => {
	const user = req.params.user;
	const url = `https://scenexe2.io/account?u=${user}`;
    const userData = req.session.userData;

	try {
		const response = await fetch(url);
		const data = await response.json();
        const userData = req.session.userData;

		const formatNumber = (num) => {
			if (num >= 1e15)
				return (num / 1e15).toFixed(1).replace(/\.0$/, "") + "qa";
			if (num >= 1e12) return (num / 1e12).toFixed(1).replace(/\.0$/, "") + "t";
			if (num >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0$/, "") + "b";
			if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, "") + "m";
			if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
			return num;
		};

        async function playercount() {
            const url = 'https://scenexe2.io/playercount';
            try {
                const response = await fetch(url);
                const data = await response.json();
                let playerCountList = '';
                for (const key in data) {
                    if (data.hasOwnProperty(key) && key !== 'total') {
                        playerCountList += `${key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim()}: ${data[key]}<br>`;
                    }
                }
                return playerCountList;
            } catch (error) {
                console.error('Error fetching player count:', error);
                return 'Error fetching player count';
            }
        }

		function formatStars(stars) {
			if (stars >= 1000) {
				return stars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
			}
			return stars;
		}

        function formatTime(seconds) {
            const days = Math.floor(seconds / (3600 * 24));
            const hours = Math.floor((seconds % (3600 * 24)) / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const remainingSeconds = seconds % 60;
        
            if (days > 0) {
                return `${days}d`;
            } else if (hours > 0) {
                return `${hours}h`;
            } else if (minutes > 0) {
                return `${minutes}m`;
            } else {
                return `${seconds}s`;
            }
        }
        
        const pfp = database[user] ? database[user][1] : 'https://cdn.discordapp.com/attachments/1190435941786071182/1232493881204015144/db6b020c58607f70fd2075d4891671d7.png?ex=6629a8df&is=6628575f&hm=b54a778ad090e0ddcd32d52c66a1207a387bc503671eab4fea9729554d3c3731&';
        const backgrounds = [
            "https://cdn.discordapp.com/attachments/1215616270100074516/1231024713107509349/image.png?ex=6635741a&is=6622ff1a&hm=20d5e6cde113220d0d9f548b079bddffcc72c3de0998519bdaa40bd898796839&",
            "https://cdn.discordapp.com/attachments/1215616270100074516/1231024713426538496/image.png?ex=6635741b&is=6622ff1b&hm=4c78e36b2c79a14363e94974e210ebe729cbcd83afe3c3d29983c811ea609e68&",
            "https://cdn.discordapp.com/attachments/1215616270100074516/1231024713720008784/image.png?ex=6635741b&is=6622ff1b&hm=2f5b033a506d3573aee2595a130126348c6ef06ac5cd44479a8437ec952dc65a&",
            "https://cdn.discordapp.com/attachments/1215616270100074516/1231024713988313158/image.png?ex=6635741b&is=6622ff1b&hm=f94e9456ebafbbab0ad5ea73ca8664ab15281828d91a0140cb6f25c56c839b4a&",
        ]
        const background = backgrounds[Math.floor(Math.random() * backgrounds.length)];
        const playercountlist = await playercount();
        const polygonGalleryImages = [
            //polyhedra
            "https://media.discordapp.net/attachments/1016463628813213838/1233008159631872040/wsrr58A9ieGfw2VvS5P3LW1EniaDgaht2DAlZyjw3ZSTEy73Ay.png?ex=662b87d5&is=662a3655&hm=ed30c3905c448cb4bed16894330cb69b2aaf1b69f18ed2e280b4bb6c24eb366f&=&format=webp&quality=lossless",
            "https://media.discordapp.net/attachments/1016463628813213838/1233008281388318841/GuaSwwbqpkmtMt5NyBweN3xqvfpFFZdxqOVw9fNDTojuiUNJEx.png?ex=662b87f2&is=662a3672&hm=ab0d0881e3cbdc5bbab44d07b137f83147ff47ea4f5b7b3d175a69b5b2ac23e7&=&format=webp&quality=lossless",
            "https://media.discordapp.net/attachments/1016463628813213838/1233008414473457675/QnPUsfZZdCBCdH4nU0oKOiWrGTtFswhXQQNkrU3urnfOPWlBL7.png?ex=662b8812&is=662a3692&hm=9b9088e43f5dd414021d1a5e1c06b5ee29ed491e7324ac01634b2efdfcc6fd84&=&format=webp&quality=lossless",
            "https://media.discordapp.net/attachments/1016463628813213838/1233008604320370698/zSwluTn3ru5y05nW1bae0LrasOSqk2PQHotg6Jnge1W3xDUQS2.png?ex=662b883f&is=662a36bf&hm=ca02ffd0d1b51d9a879d7fe1211520c4c56909b886f0c2b51220993c7e83e3ff&=&format=webp&quality=lossless",
            "https://media.discordapp.net/attachments/1016463628813213838/1233008822508060802/I7pK1TN4HdcgefSCh2kyq44VqaDm1jmubcs0Cw22QwlDulu0mi.png?ex=662b8873&is=662a36f3&hm=48f0490d6a991afb15154b04e5fe651680aca7f126f548bc3bdd6f04ba983653&=&format=webp&quality=lossless",
            //polygons
            "https://media.discordapp.net/attachments/1016463628813213838/1233000250201870386/tE26uAPZZrqfBr6iasi52fvmjkZmaB9GjqFSM0GWpv8FIZELe0.png?ex=662b8077&is=662a2ef7&hm=749fd3989b6301673c105ba52a2c3f0e9cc8e789f35182c3bc92a01ca6da1063&=&format=webp&quality=lossless",
            "https://media.discordapp.net/attachments/1016463628813213838/1233000856190976051/DpCqtO1b6UJyX2VVQjWAQ8kKgkL7lwuAWIuUbhiXY6ozAlr83z.png?ex=662b8108&is=662a2f88&hm=46d778c61f32ff3504c14e1657c70f32cba7c9f4cef5fce6612e9f4d43dd076b&=&format=webp&quality=lossless",
            "https://media.discordapp.net/attachments/1016463628813213838/1233001044833992714/ybmmhF9bCdPjAQXJKpn9tJxe06UNrRDdcf4Vpi6TQkJ8OVg3dC.png?ex=662b8135&is=662a2fb5&hm=1230e96fa61d4f6d442e146dd03475c0a3c5420f301a9ade54faa80368ce5072&=&format=webp&quality=lossless",
            "https://media.discordapp.net/attachments/1016463628813213838/1233001607340232704/7IdoTbZ4C9sihr2MzbHCb8rtK88d4bzVjFxGn4TXM3onGTXuXl.png?ex=662b81bb&is=662a303b&hm=40558f2057e8bda92a1462ccc06db0a62fb1e875206b4ce5bd51f41ff81a79fc&=&format=webp&quality=lossless",
            "https://media.discordapp.net/attachments/1016463628813213838/1233001622066430043/XKq0gzeQBZLENPRrshuHPv1wRbYilo7oOIhTEmFIij4makBB85.png?ex=662b81be&is=662a303e&hm=52bddc450cb61d3c43c95b060b128a351e32d2eedb0e2ef04b6129ae18eae8b2&=&format=webp&quality=lossless",
            "https://media.discordapp.net/attachments/1016463628813213838/1233002073914867793/30ss3qK7oY1Xs9pRhDKB3RL7l838qNEGCzQvGTYpg0N8DzGciL.png?ex=662b822a&is=662a30aa&hm=2dc737d8b2437c3e48a713775cbb45489843891ac2a79f8c0a9ed3b65c7972cf&=&format=webp&quality=lossless",
            "https://media.discordapp.net/attachments/1016463628813213838/1233002237735866418/BHhUzMqdPWbq1XFBCCijid44XhbqMDYV0D55bHQeGexLIEhbi2.png?ex=662b8251&is=662a30d1&hm=a6faa981aa01f471d641a00436ec31d70d5a25c93bfc75dc0f7a43a8095e7550&=&format=webp&quality=lossless",
            "https://media.discordapp.net/attachments/1016463628813213838/1233002685104394310/327IRpDx8ggkQ0kAuMjHXS9qiLmsvCcaXj5eC9n02kS37Mu1xf.png?ex=662b82bc&is=662a313c&hm=877e8b69b88c10ae6f92eb8ecd80e4e01d955edc4197946a563919c01bd252ad&=&format=webp&quality=lossless",
            "https://media.discordapp.net/attachments/1016463628813213838/1233003634426511420/6E74MeNhiYqmlmnigJotoMBZLAdSJDb6wDp9bQMfsqduMQIVma.png?ex=662b839e&is=662a321e&hm=779c133c774521a5fd8d3e34d0c70e1a9790824bde9e36d190ca7bbb3037e657&=&format=webp&quality=lossless",
            "https://media.discordapp.net/attachments/1016463628813213838/1233003931622309919/1qJgCpyl1BPa3QusCHnZz09qth3BQRYoigaw74nzDGYeeUI514.png?ex=662b83e5&is=662a3265&hm=d09da8635eb5365f29c47ab6f172d531936e7f6fdf55f8e7fe689dcae97d803b&=&format=webp&quality=lossless",
            "https://media.discordapp.net/attachments/1016463628813213838/1233004508125204490/ZFwBKNo69C7WWFwEGOSlS0QlTNup7xTson1DEV4vuHwwh9SxpQ.png?ex=662b846e&is=662a32ee&hm=b3bf56cd17a3700c7899733ea971cfa2aa6712c5d700982260ee107178f8484b&=&format=webp&quality=lossless",
            "https://media.discordapp.net/attachments/1016463628813213838/1233005212533522432/VHWGaz22TPKBy7XDRexqJ3IeJswPtXk8F6DIJD6JyvyGfFEiQL.png?ex=662b8516&is=662a3396&hm=58852d78bd260e95016820a6ee29cde899984f624d5b077cf7e588e821eb8126&=&format=webp&quality=lossless",
            "https://media.discordapp.net/attachments/1016463628813213838/1233005494516453396/ftvBEdqnSSbJlFAtrVQujnDNyfWkNG0nka6ZjIsTmDiAzC4bmr.png?ex=662b855a&is=662a33da&hm=7f00c80a0fc865014302e3b732384f9f1207affd827ea5f32b7396665c31ddcc&=&format=webp&quality=lossless",
            "https://media.discordapp.net/attachments/1016463628813213838/1233005806467813428/rlZ0gmipJ1setERIgMSqeDB3yVJdJay8Nmt3OP9AOx3xYi6KnC.png?ex=662b85a4&is=662a3424&hm=c0700fe42149ee6fcdba6d9be798119f7cc0c4f93797feffd767464de2386a11&=&format=webp&quality=lossless",
            "https://media.discordapp.net/attachments/1016463628813213838/1233006037095677992/qulAFiyaDfIb4nhM1ofAZtP0EORaJRyFPdG1VBcWhY8RPQOGGe.png?ex=662b85db&is=662a345b&hm=7152dcbdc065e4dc5480a0a1b2100b95dd2ea7a069abd2b846d15f851b35a5e8&=&format=webp&quality=lossless",
            "https://media.discordapp.net/attachments/1016463628813213838/1233007128906563689/438oZiKUrPCk9bBQiF473BT1I88lNAM3SjVto7YhI07egclNpW.png?ex=662b86df&is=662a355f&hm=7229b09d391128aa640fdd8ab97508b4ac3ae28cdd6bf5748b78ee0899afa951&=&format=webp&quality=lossless",
            "https://media.discordapp.net/attachments/1016463628813213838/1233007261916332042/vkBYVg6rF0TuNE6Ba9wQBnb3u3eU3tQ99Uru5NuT5Rw10Znyde.png?ex=662b86ff&is=662a357f&hm=69267c3dc6253d56bb00ebeb94d97dec11a78fa5144a6f85adf29c78754335e7&=&format=webp&quality=lossless",
            "https://media.discordapp.net/attachments/1016463628813213838/1233007543719170149/IOuJuBbG7EqASFXIt0Vr07wQNPP7617NcEH1sanuoZbvMXMS5I.png?ex=662b8742&is=662a35c2&hm=265015707e1b7ff4a8ac9f55900a54a0a84382dcbb7f11e3d1a07b71a1bc7d81&=&format=webp&quality=lossless",
        ]
        //polyhedra
        const polygonGalleryImage0 = polygonGalleryImages[0]
        const polygonGalleryImage1 = polygonGalleryImages[1]
        const polygonGalleryImage2 = polygonGalleryImages[2]
        const polygonGalleryImage3 = polygonGalleryImages[3]
        const polygonGalleryImage4 = polygonGalleryImages[4]
        //polygons
        const polygonGalleryImage5 = polygonGalleryImages[5]
        const polygonGalleryImage6 = polygonGalleryImages[6]
        const polygonGalleryImage7 = polygonGalleryImages[7]
        const polygonGalleryImage8 = polygonGalleryImages[8]
        const polygonGalleryImage9 = polygonGalleryImages[9]
        const polygonGalleryImage10 = polygonGalleryImages[10]
        const polygonGalleryImage11 = polygonGalleryImages[11]
        const polygonGalleryImage12 = polygonGalleryImages[12]
        const polygonGalleryImage13 = polygonGalleryImages[13]
        const polygonGalleryImage14 = polygonGalleryImages[14]
        const polygonGalleryImage15 = polygonGalleryImages[15]
        const polygonGalleryImage16 = polygonGalleryImages[16]
        const polygonGalleryImage17 = polygonGalleryImages[17]
        const polygonGalleryImage18 = polygonGalleryImages[18]
        const polygonGalleryImage19 = polygonGalleryImages[19]
        const polygonGalleryImage20 = polygonGalleryImages[20]
        const polygonGalleryImage21 = polygonGalleryImages[21]
        const polygonGalleryImage22 = polygonGalleryImages[22]

        function convertToBinary(inputGallery) {
            let binaryGallery = [];
            let galleryLength = data.gallery.length
            for (let i = 0; i < galleryLength; i++) {
                let number = inputGallery[i];
                let binaryNumber = number.toString(2);
                binaryGallery.push(binaryNumber);
            }
            return binaryGallery;
        }
        
        let inputGallery = [
            (data.gallery[0]), 
            (data.gallery[1]), 
            (data.gallery[2]), 
            (data.gallery[3]), 
            (data.gallery[4]), 
            (data.gallery[5]), 
            (data.gallery[6]), 
            (data.gallery[7]), 
            (data.gallery[8]), 
            (data.gallery[9]), 
            (data.gallery[10]), 
            (data.gallery[11]), 
            (data.gallery[12]), 
            (data.gallery[13]), 
            (data.gallery[14]), 
            (data.gallery[15]),
            (data.gallery[16]),
            (data.gallery[17]),
            (data.gallery[18]),
            (data.gallery[19]),
            (data.gallery[20]),
            (data.gallery[21]),
            (data.gallery[22])
        ];
        
        let binaryGalleryFinal = convertToBinary(inputGallery);
        console.log(data.username + ":" +  "[" + [binaryGalleryFinal] + "]");

        function reverseNumInArray(arr) {
            let reversedArray = [];
        
            for (let num of arr) {
                let numStr = num.toString();
                
                let reversedNumStr = numStr.split('').reverse().join('');
                
                let reversedNum = parseInt(reversedNumStr);
        
                reversedArray.push(reversedNum);
            }
        
            return reversedArray;
        }
        
        let originalArray = binaryGalleryFinal;
        let reversedArray = reverseNumInArray(originalArray);
        console.log(data.username + "(REVERSED)" + ":" + "[" + reversedArray.join(',') + "]");
        
		const html = `
    <!DOCTYPE html>
    <html>
    <head>
    <meta name="description" content="A fan made scenexe2 peofile viewer">
    <link rel="shortcut icon" href="https://cdn.glitch.global/29134419-8262-4621-b4dc-41149f958893/scenexe.png">
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">
        <style>
             body {
                overflow: hidden;
                font-family: 'Roboto', sans-serif;
                font-weight: 700;
                background-image: url('${background}'); 
                background-size: cover;
                background-repeat: no-repeat;
                color: white;
                text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 2px 2px 0 #000;
                margin: 0;
                height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: flex-start;
                justify-content: flex-start;
                padding: 20px;
                z-index: 1;
            }

            body::before {
                content: "";
                position: fixed;
                top: 0;
                right: 0;
                bottom: 0;
                left: 0;
                background-color: rgba(0, 0, 0, 0.5);
                z-index: 0;
            }
    
            .profile-container {
                display: flex;
                align-items: center;
                gap: 20px;
                z-index: 3;
            }
            
            .profile-image {
                width: 92px;
                height: 92px;
                border-radius: 50%;
                border-style: solid;
                border-color: black;
                border-width: 5px;
                z-index: 3;
            }
            
            .profile-info {
                display: flex;
                flex-direction: column;
                z-index: 3;
            }
    
            .profile-info h1 {
                font-size: 3em;
                margin: -3px;
                z-index: 3;
            }

            .profile-info p {
                font-size: 1.2em;
                margin: -3px;
                z-index: 3;
            }
            
            .description {
                font-size: 1.2em;
                margin-top: 5px;
                z-index: 3;
            }
            
            .stats-container {
                display: flex;
                justify-content: space-between;
                width: 100%;
                max-width: 600px;
                margin-bottom: 30px;
                z-index: 3;
            }
            
            .stats-item {
                flex: 1;
                text-align: center; 
                font-weight: bold;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 0px 65px;
                z-index: 3;
            }
            
            .stats-item .text {
                font-size: 1.4em;
                z-index: 3;
            }
            
            .stats-item .value {
                font-size: 0.8em;
                z-index: 3;
            }

            hr {
                color: white;
                border: 0;
                border-top: 3px solid rgb(0,0,0);
                height: 20px;
                width: 100%;
                z-index: 3;
            }

            .hr2 {
                color: white;
                border: 0;
                border-top: 3px solid rgb(0,0,0);
                height: 20px;
                width: 100%;
                z-index: 3;
                margin-bottom: 5px;
            }

            .search-container {
                position: fixed;
                top: 10px;
                right: 10px;
                z-index: 1000;
            }
    
            .search-form {
                display: flex;
                align-items: center;
                border-style: solid;
                border-width: 4px;
                border-color: rgb(0, 0, 0);
                border-radius: 5px;
                background-color: rgba(0, 0, 0, 0.3);
                padding: 3px 5px;
            }
            
            .shape {
                width: 20px;
                height: 20px;
                float: left:
                margin-left: 10px;
            }

            .search-input {
                flex-grow: 0;
                border: none;
                background-color: transparent;
                color: white;
            }
    
            .search-button-image {
                cursor: pointer;
                width: 25px; 
                height: 25px;
                border-style: solid;
                border-color: rgba(0, 0, 0, 1);
                border-width: 3px;
                border-radius: 3px;
                background-color: white;
            }

            .boxes-container {
                display: flex;
                flex-wrap: wrap;
                justify-content: space-between;
                gap: 20px; 
            }

            .box {
                background: rgba(69, 69, 69, 0.3);
                border: solid 2px black;
                border-radius: 5px;
                padding: 20px;
                margin-top: 20px;
                font-size: 25px;
                z-index: 100;
            }

            .box-title {
                font-size: 25px;
            }

            .box-value {
                font-size: 20px;
                max-height: 300px;
                overflow-y: scroll;
                z-index: 101;
            }

        </style>
    </head>
    <body>
        <div class="search-container">
            <form class="search-form" id="searchForm">
                <input class="search-input" type="text" name="query" placeholder="Search...">
                <button type="submit" class="search-button">
                    <img class="search-button-image" src="https://scenexe.io/assets/search.png" alt="Search">
                </button>
            </form>
        </div>
        <script>
        document.getElementById('searchForm').addEventListener('submit', function(event) {
            event.preventDefault();
            const input = document.querySelector('.search-input').value;
            const url = '/account/' + encodeURIComponent(input);
            window.location.href = url; // Open the URL in the same tab
        });
        </script>
        <div class="profile-container">
            <img class="profile-image" src="${pfp}" alt="Profile Picture">
            <div class="profile-info">
                <h1>${data.username}</h1>
                <p>⭐${formatStars(data.stars)}</p>
            </div>
        </div>
        <div class="description">${data.description}</div>
        <hr>
        <div class="stats-container">
            <div class="stats-item">
                <div class="text">High Score</div>
                <div class="value">${formatNumber(data.maxScore)}</div>
            </div>
            <div class="stats-item">
                <div class="text">Celestial Kills</div>
                <div class="value">${formatNumber(data.celestialKills)}</div>
            </div>
            <div class="stats-item">
                <div class="text">Ascensions</div>
                <div class="value">${formatNumber(data.ascensions)}</div>
            </div>
            <div class="stats-item">
                <div class="text">Playtime</div>
                <div class="value">${formatTime(data.timePlayed)}</div>
            </div>
            <div class="stats-item">
                <div class="text">Tank Kills</div>
                <div class="value">${formatNumber(data.tankKills)}</div>
            </div>
        </div>
        <hr>
        <div class="boxes-container">
            <div class="box">
                <div class="box-value">
                    <div class="box-title">Player Count</div>
                    <hr class="hr2">
                    <div>${playercountlist}</div>
                </div>
            </div>
            <div class="box">
                <div class="box-value">
                    <div class="box-title">Additional Info</div>
                    <hr class="hr2">
                    <div>Polygon Kills: ${formatNumber(data.polygonKills)}</div>
                </div>
            </div>
            <div class="box">
                <div class="box-value">
                    <div class="box-title">Polygon Gallery</div>
                    <hr class="hr2">
                    <p>Radiant: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9<p>
                    <img class="shape" src= ${polygonGalleryImage5}
                    <div>${(reversedArray[5])}</div>
                    <img class="shape" src= ${polygonGalleryImage6}
                    <div>${(reversedArray[6])}</div>
                </div>
            </div>
        </div>
    </body>
    </html>                 
    `;
		res.send(html);
	} catch (error) {
		console.error(error);
		res.status(500).send("Error fetching data");
	}
});

app.get('/', async (req, res) => {
    const users = Object.keys(database);

    const usersbox = await Promise.all(users.map(async (username) => {
        const response = await fetch(`https://scenexe2.io/account?u=${encodeURIComponent(username)}`);
        const userData = await response.json();
        const stars = userData.stars;

        return `
            <div class="box">
                <div class="box-title">
                <a href="${host}:${port}/account/${username}">${username}</a>
                </div>
                <div class="box-value">
                    <div>⭐ ${stars}</div>
                </div>
            </div>
        `;
    }));

    const usersboxHtml = usersbox.join('');

    const backgrounds = [
        "https://cdn.discordapp.com/attachments/1215616270100074516/1231024713107509349/image.png?ex=6635741a&is=6622ff1a&hm=20d5e6cde113220d0d9f548b079bddffcc72c3de0998519bdaa40bd898796839&",
        "https://cdn.discordapp.com/attachments/1215616270100074516/1231024713426538496/image.png?ex=6635741b&is=6622ff1b&hm=4c78e36b2c79a14363e94974e210ebe729cbcd83afe3c3d29983c811ea609e68&",
        "https://cdn.discordapp.com/attachments/1215616270100074516/1231024713720008784/image.png?ex=6635741b&is=6622ff1b&hm=2f5b033a506d3573aee2595a130126348c6ef06ac5cd44479a8437ec952dc65a&",
        "https://cdn.discordapp.com/attachments/1215616270100074516/1231024713988313158/image.png?ex=6635741b&is=6622ff1b&hm=f94e9456ebafbbab0ad5ea73ca8664ab15281828d91a0140cb6f25c56c839b4a&",
    ];
    const background = backgrounds[Math.floor(Math.random() * backgrounds.length)];

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>scenexe2 profiles</title>
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">
        <style>
             body {
                overflow: hidden;
                font-family: 'Roboto', sans-serif;
                font-weight: 700;
                background-image: url('${background}'); 
                background-size: cover;
                background-repeat: no-repeat;
                color: white;
                text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 2px 2px 0 #000;
                margin: 0;
                height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: flex-start;
                justify-content: flex-start;
                padding: 20px;
                z-index: 1;
            }

            body::before {
                content: "";
                position: fixed;
                top: 0;
                right: 0;
                bottom: 0;
                left: 0;
                background-color: rgba(0, 0, 0, 0.5);
                z-index: 0;
            }
    
            .profile-container {
                display: flex;
                align-items: center;
                gap: 20px;
                z-index: 3;
            }
            
            .profile-image {
                width: 92px;
                height: 92px;
                border-radius: 50%;
                border-style: solid;
                border-color: black;
                border-width: 5px;
                z-index: 3;
            }
            
            .profile-info {
                display: flex;
                flex-direction: column;
                z-index: 3;
            }
    
            .profile-info h1 {
                font-size: 3em;
                margin: -3px;
                z-index: 3;
            }

            .profile-info p {
                font-size: 1.2em;
                margin: -3px;
                z-index: 3;
            }
            
            .description {
                font-size: 1.2em;
                margin-top: 5px;
                z-index: 3;
            }
            
            .stats-container {
                display: flex;
                justify-content: space-between;
                width: 100%;
                max-width: 600px;
                margin-bottom: 30px;
                z-index: 3;
            }
            
            .stats-item {
                flex: 1;
                text-align: center; 
                font-weight: bold;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 0px 65px;
                z-index: 3;
            }
            
            .stats-item .text {
                font-size: 1.4em;
                z-index: 3;
            }
            
            .stats-item .value {
                font-size: 0.8em;
                z-index: 3;
            }

            hr {
                color: white;
                border: 0;
                border-top: 3px solid rgb(0,0,0);
                height: 20px;
                width: 100%;
                z-index: 3;
            }

            .hr2 {
                color: white;
                border: 0;
                border-top: 3px solid rgb(0,0,0);
                height: 20px;
                width: 100%;
                z-index: 3;
                margin-bottom: 5px;
            }

            .search-container {
                position: fixed;
                top: 10px;
                right: 10px;
                z-index: 1000;
            }
    
            .search-form {
                display: flex;
                align-items: center;
                border-style: solid;
                border-width: 4px;
                border-color: rgb(0, 0, 0);
                border-radius: 5px;
                background-color: rgba(0, 0, 0, 0.3);
                padding: 3px 5px;
            }
    
            .search-input {
                flex-grow: 0;
                border: none;
                background-color: transparent;
                color: white;
            }

            .search-button {
                position: relative;
                cursor: pointer;
                width: 25px; 
                height: 25px;
                border-style: solid;
                border-color: rgba(0, 0, 0, 1);
                border-width: 3px;
                border-radius: 3px;
                background-color: white;
                opacity: 0;
                z-index: 301;
            }
            
            .search-button-image {
                top: 0;
                right: 0;
                cursor: pointer;
                width: 25px; 
                height: 25px;
                border-style: solid;
                border-color: rgba(0, 0, 0, 1);
                border-width: 3px;
                border-radius: 3px;
                background-color: white;
                opacity: 1;
                z-index: 300;
            }
            

            .boxes-container {
                display: flex;
                flex-wrap: wrap;
                justify-content: space-between;
                gap: 20px; 
                overflow-y: scroll;
            }

            .box {
                background: rgba(69, 69, 69, 0.3);
                border: solid 2px black;
                border-radius: 5px;
                padding: 20px;
                margin-top: 20px;
                font-size: 25px;
                z-index: 100;
            }

            .box-title {
                font-size: 25px;
            }

            .box-value {
                font-size: 20px;
                max-height: 300px;
                overflow-y: hidden;
                z-index: 101;
            }
        </style>
    </head>
    <body>
    <div class="search-container">
        <form class="search-form" id="searchForm">
            <input class="search-input" type="text" name="query" placeholder="Search...">
            <button type="submit" class="search-button">
            <img class="search-button-image" src="https://scenexe.io/assets/search.png" alt="Search">
            </button>
        </form>
    </div>
    <script>
    document.getElementById('searchForm').addEventListener('submit', function(event) {
        event.preventDefault();
        const input = document.querySelector('.search-input').value;
        const url = '/account/' + encodeURIComponent(input);
        window.location.href = url; // Open the URL in the same tab
    });
    </script>
    <div class="profile-container">
        <div class="profile-info">
            <h1>scenexe2.io profiles</h1>
        </div>
    </div>
    <div class="description">hello chat</div>
    <button onclick="window.location.href("/link")">link!</button>
    <hr>
    <div class="boxes-container">
        ${usersbox}
    </div>
    </body>
    </html>
    `;

    res.send(html);
});

//if you want to host on your own domain
//you need a server, domain and ssl

/*
const privateKey = fs.readFileSync('key.pem', 'utf8'); 
const certificate = fs.readFileSync('cert.pem', 'utf8');

const credentials = { key: privateKey, cert: certificate };

const httpsServer = https.createServer(credentials, app);

httpsServer.listen(port, () => {
    console.log(`Server running at ${host}:${port}`);
});
*/


app.listen(port, '0.0.0.0', () => {
	console.log(`Server running at ${host}:${port}`);
});
