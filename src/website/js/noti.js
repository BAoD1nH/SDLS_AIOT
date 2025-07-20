// Get Device ID by Device Name using PushSafer API
async function getDeviceIDByDeviceName(userData) {
    const apiKey = "PuTYt4lh8MO31Brkcp38";
    const email = "nguyencongtuan0810@gmail.com";
    const account = userData.Email;

    try {
        const response = await fetch(`https://www.pushsafer.com/api-de?k=${encodeURIComponent(apiKey)}&u=${encodeURIComponent(email)}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const result = await response.json();

        if (result.status === 1) {
            const device = Object.values(result.devices).find(device => device.name === account);
            if (device) {
                return device.id;
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

// Helper function to send PushSafer notifications
async function sendPushSaferNotification(deviceID, userData, title, message, apiKey) {
    if (!deviceID) {
        alert("Device not found. Registering new device...");
        return false;
    }

    const params = new URLSearchParams({
        t: title,
        m: message,
        s: "1", // sound
        v: "1", // vibration
        d: deviceID,
        k: apiKey
    });

    try {
        const response = await fetch("https://www.pushsafer.com/api", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: params
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const result = await response.json();

        if (result.status === 1) {
            alert('Push notification sent successfully.');
            return true;
        } else {
            alert(`Failed to send push notification. Error: ${result.error}`);
            return false;
        }
    } catch (error) {
        console.error('Failed to send push notification:', error);
        alert('Failed to send push notification. Please check the console for more details.');
        return false;
    }
}

// Send Push Notification when user registers/updates door lock password
export async function sendPushNotification(userData, lockPassword) {
    const deviceID = await getDeviceIDByDeviceName(userData);
    const apiKey = "PuTYt4lh8MO31Brkcp38";
    const title = "Lock Password Updated";
    const message = `Hi ${userData.Name}, your lock password has been updated to: ${lockPassword}`;

    return await sendPushSaferNotification(deviceID, userData, title, message, apiKey);
}

// Send Push Notification when DOOR LOCK detects illegal activity
export async function sendPushWarningNotification(userData) {
    const deviceID = await getDeviceIDByDeviceName(userData);
    const apiKey = "PuTYt4lh8MO31Brkcp38";
    const title = "Warning: Suspicious Entry Activities Detected";
    const message = `Hi ${userData.Name}, \nSomeone is trying to enter your building. Please check your security system.`;

    return await sendPushSaferNotification(deviceID, userData, title, message, apiKey);
}

// Send Push Notification when DOOR LOCK opened successfully
export async function sendDoorOpenNotification(userData) {
    const deviceID = await getDeviceIDByDeviceName(userData);
    const apiKey = "bdVop1HtPdwgAyw2SMQu"; // Note: Different API key
    const title = "Door Lock Opened";
    const message = `Hi ${userData.Name}, your door lock was successfully opened.`;

    return await sendPushSaferNotification(deviceID, userData, title, message, apiKey);
}