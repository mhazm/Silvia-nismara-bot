function isManager(member, managerRoleId) {
	if (!member || !managerRoleId) return false;
	return member.roles.cache.has(managerRoleId);
}

module.exports = { isManager };
