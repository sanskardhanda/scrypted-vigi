const keyShort = 'RDpbLfCPsJZ7fiv';
const keyLong = 'yLwVl0zKqws7LgKPRQ84Mdt708T1qQ3Ha7xv3H7NyU84p21BriUWBU43odz3iP4rBL3cD02KZciXTysVXiV8ngg6vL48rPJyAUw0HurW20xqxv9aYb4M9wK1Ae0wlro510qXeU07kV57fQMc8L6aLgMLwygtc0F10a0Dg70TOoouyFhdysuRMO51yY5ZlOZZLEal1h0t9YQW0Ko7oBwmCAHoic4HYbUyVeU3sfQ1xtXcPcf1aT303wAQhv66qzW';

export function securityEncode(input: string): string {
    const size = input.length;
    const n = Math.max(size, keyShort.length);
    const output: string[] = [];

    for (let i = 0; i < n; i++) {
        let c1 = 187;
        let c2 = 187;

        if (i >= size) {
            c1 = keyShort.charCodeAt(i);
        }
        else if (i >= keyShort.length) {
            c2 = input.charCodeAt(i);
        }
        else {
            c1 = keyShort.charCodeAt(i);
            c2 = input.charCodeAt(i);
        }

        output.push(keyLong[(c1 ^ c2) % keyLong.length]);
    }

    return output.join('');
}
