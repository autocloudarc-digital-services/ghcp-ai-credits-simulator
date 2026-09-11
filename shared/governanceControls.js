const controls = require("./governanceTiers.json");

function classifyBudgetControl(profile) {
  if (profile.budgetType === "ulb") {
    if (profile.scope === "user") return "individual-ulb";
    if (profile.scope === "cost-center") return "cost-center-ulb";
    if (profile.scope === "enterprise") return "universal-ulb";
  }
  if (profile.budgetType === "metered-overage") {
    if (profile.scope === "cost-center") return "cost-center-metered-budget";
    if (profile.scope === "organization") return "organization-metered-budget";
    if (profile.scope === "enterprise") return "enterprise-metered-budget";
  }
  if (profile.budgetType === "org-policy") return "organization-policy";
  if (profile.budgetType === "included") return "included-pool";
  return "unclassified";
}

function budgetControlLabel(profile) {
  const id = classifyBudgetControl(profile);
  return (
    controls.find((control) => control.id === id)?.title ??
    {
      "organization-policy": "Organization policy (not a budget)",
      "included-pool": "Included AI credit pool (not a budget)",
      unclassified: "Unclassified control",
    }[id]
  );
}

module.exports = { classifyBudgetControl, budgetControlLabel };
