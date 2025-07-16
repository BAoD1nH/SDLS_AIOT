// Using PushSafer
// Find the deviceID by device name though API provided by PushSafer
async function getDeviceIDByDeviceName(userData) {
    const apiKey = "PuTYt4lh8MO31Brkcp38";
    const email = "nguyencongtuan0810@gmail.com";
    const account = `${userData.Email}`;

    try {
        const response = await fetch(`https://www.pushsafer.com/api-de?k=${apiKey}&u=${email}`);
        const result = await response.json();

        if (result.status === 1) {
            const devices = result.devices;

            for (const key in devices) {
                if (devices[key].name === account) {
                    return devices[key].id;
                }
            }
            console.log('Device not found.');
            return null;
        } else {
            console.error('Failed to retrieve devices. Error:', result.error);
            return null;
        }
    } catch (error) {
        console.error('Error fetching devices from PushSafer:', error);
        return null;
    }
}

// Send the Push Notification to the deviceID - PushSafer - when the user register / update the door lock password
export async function sendPushNotification(userData, lockPassword) {
    let deviceID = await getDeviceIDByDeviceName(userData);

    if (!deviceID) {
        alert("Device not found. Registering new device...");
        return;
    }

    const apiKey = "PuTYt4lh8MO31Brkcp38";
    const title = "Lock Password Updated";
    const message = `Hi ${userData.Name}, your lock password has been updated to: ${lockPassword}`;
    const sound = "1";
    const vibration = "1";

    let xhttp = new XMLHttpRequest();
    xhttp.open("POST", "https://www.pushsafer.com/api", true);
    xhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");

    xhttp.onreadystatechange = function () {
        if (xhttp.readyState === XMLHttpRequest.DONE) {
            if (xhttp.status === 200) {
                const result = JSON.parse(xhttp.responseText);
                console.log('PushSafer API response:', result);

                if (result.status === 1) {
                    alert('Push notification sent successfully.');
                } else {
                    alert('Failed to send push notification. Error: ' + result.error);
                }
            } else {
                console.error('Failed to send push notification. Status:', xhttp.status);
                alert('Failed to send push notification. Please check the console for more details.');
            }
        }
    };

    xhttp.send(`t=${encodeURIComponent(title)}&m=${encodeURIComponent(message)}&s=${sound}&v=${vibration}&d=${encodeURIComponent(deviceID)}&k=${encodeURIComponent(apiKey)}`);
}

// Send the Push Notification to the deviceID - PushSafer - when the DOOR LOCK detected any illegal activity
export async function sendPushWarningNotification(userData) {
    let deviceID = await getDeviceIDByDeviceName(userData);

    if (!deviceID) {
        alert("Device not found. Registering new device...");
        return;
    }

    const apiKey = "PuTYt4lh8MO31Brkcp38";
    const title = "Warning: Suspicious Entry Activities Detected";
    const message = `Hi ${userData.Name}, \nSomeone is trying to enter your building. Please check your security system.`;
    const sound = "1";
    const vibration = "1";

    let xhttp = new XMLHttpRequest();
    xhttp.open("POST", "https://www.pushsafer.com/api", true);
    xhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");

    xhttp.onreadystatechange = function () {
        if (xhttp.readyState === XMLHttpRequest.DONE) {
            if (xhttp.status === 200) {
                const result = JSON.parse(xhttp.responseText);
                console.log('PushSafer API response:', result);

                if (result.status === 1) {
                    alert('Push notification sent successfully.');
                } else {
                    alert('Failed to send push notification. Error: ' + result.error);
                }
            } else {
                console.error('Failed to send push notification. Status:', xhttp.status);
                alert('Failed to send push notification. Please check the console for more details.');
            }
        }
    };

    xhttp.send(`t=${encodeURIComponent(title)}&m=${encodeURIComponent(message)}&s=${sound}&v=${vibration}&d=${encodeURIComponent(deviceID)}&k=${encodeURIComponent(apiKey)}`);
}

// Send the Push Notification to the deviceID - PushSafer - when the DOOR LOCK is opened successfully
export async function sendDoorOpenNotification(userData) {
    let deviceID = await getDeviceIDByDeviceName(userData);

    if (!deviceID) {
        alert("Device not found. Registering new device...");
        return;
    }

    const apiKey = "bdVop1HtPdwgAyw2SMQu";
    const title = "Door Lock Opened";
    const message = `Hi ${userData.Name}, your door lock was successfully opened.`;
    const sound = "1";
    const vibration = "1";

    let xhttp = new XMLHttpRequest();
    xhttp.open("POST", "https://www.pushsafer.com/api", true);
    xhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");

    xhttp.onreadystatechange = function () {
        if (xhttp.readyState === XMLHttpRequest.DONE) {
            if (xhttp.status === 200) {
                const result = JSON.parse(xhttp.responseText);
                console.log('PushSafer API response:', result);

                if (result.status === 1) {
                    alert('Push notification sent successfully.');
                } else {
                    alert('Failed to send push notification. Error: ' + result.error);
                }
            } else {
                console.error('Failed to send push notification. Status:', xhttp.status);
                alert('Failed to send push notification. Please check the console for more details.');
            }
        }
    };

    xhttp.send(`t=${encodeURIComponent(title)}&m=${encodeURIComponent(message)}&s=${sound}&v=${vibration}&d=${encodeURIComponent(deviceID)}&k=${encodeURIComponent(apiKey)}`);
}