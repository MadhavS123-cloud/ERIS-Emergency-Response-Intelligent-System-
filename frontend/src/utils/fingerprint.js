export const generateFingerprint = async () => {
    try {
        const nav = window.navigator;
        const screen = window.screen;
        
        // Build a raw string of consistent fingerprint indicators
        const fpElements = [
            nav.userAgent,
            nav.language,
            `${screen.width}x${screen.height}`,
            nav.hardwareConcurrency,
            Intl.DateTimeFormat().resolvedOptions().timeZone
        ];
        
        const fp = fpElements.join('||');
        
        // Fast DJB2 hash algorithm
        let hash = 5381;
        for (let i = 0; i < fp.length; i++) {
            hash = (hash * 33) ^ fp.charCodeAt(i);
        }
        
        return "fp_" + (hash >>> 0).toString(16);
    } catch (e) {
        // Fallback for strict browsers
        return "fp_" + Math.random().toString(36).substring(2, 10);
    }
};

export const getOrGenerateDeviceId = async () => {
    let deviceId = localStorage.getItem('eris_device_id');
    if (!deviceId) {
        deviceId = (await generateFingerprint()) + '_' + Date.now().toString(36);
        localStorage.setItem('eris_device_id', deviceId);
    }
    return deviceId;
};
