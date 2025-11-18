async function fetchCompanyMembers() {
    try {
        const res = await fetch(
            "https://e.truckyapp.com/api/v1/company/35643/members",
            {
                headers: {
                    "x-access-token": process.env.TRUCKY_API_KEY,
                    Accept: "application/json",
                    "User-Agent": "Mozilla/5.0"
                }
            }
        );

        if (!res.ok) return null;
        

        const json = await res.json();
        console.log(`Fetched Job Data: ${JSON.stringify(json)}`);
        return json?.data.name || [];
    } catch (err) {
        console.error("Failed to fetch company members:", err);
        return null;
    }
}

module.exports = fetchCompanyMembers;