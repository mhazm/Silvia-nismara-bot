const BASE_URL = 'https://e.truckyapp.com/api/v1';

async function getCompanyMemberByTruckyId(truckyId) {
	const companyId = process.env.TRUCKY_COMPANY_ID;
	const apiKey = process.env.TRUCKY_API_KEY;

	if (!companyId || !apiKey) return null;

	let page = 1;
	let lastPage = 1;

	try {
		do {
			const res = await fetch(
				`${BASE_URL}/company/${companyId}/members?page=${page}`,
				{
					headers: {
						'x-access-token': apiKey,
						Accept: 'application/json',
						'User-Agent':
							'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
						Referer: 'https://nismara.web.id/',
						Origin: 'https://nismara.web.id',
					},
				}
			);

			if (!res.ok) {
				console.error('[TRUCKY API]', res.status, res.statusText);
				return null;
			}

			const json = await res.json();

			const members = json.data || [];
			lastPage = json.last_page || 1;

			const member = members.find(
				m => Number(m.id) === Number(truckyId)
			);

			if (member) return member;

			page++;
		} while (page <= lastPage);

		return null;
	} catch (err) {
		console.error('[TRUCKY FETCH ERROR]', err);
		return null;
	}
}

module.exports = {
	getCompanyMemberByTruckyId,
};