import AdmZip from "adm-zip";
import forge from "node-forge";
import { parse as parsePlist } from "plist";

function extractEcontent(asn1) {
  if (!asn1 || asn1.type !== forge.asn1.Type.SEQUENCE || asn1.constructed !== true) return null;
  if (!asn1.value[0] || asn1.value[0].type !== forge.asn1.Type.OID) return null;
  const wrapper = asn1.value.find(
    (v) => v.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && v.type === 0 && v.constructed
  );
  if (!wrapper) return null;
  const signedData = wrapper.value[0];
  if (!signedData || signedData.constructed !== true) return null;
  const encap = signedData.value.find(
    (v) =>
      v.constructed === true &&
      v.type === forge.asn1.Type.SEQUENCE &&
      v.value &&
      v.value[0] &&
      v.value[0].type === forge.asn1.Type.OID
  );
  if (!encap) return null;
  const econtent = encap.value.find(
    (v) => v.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && v.type === 0
  );
  if (!econtent) return null;
  const octet = econtent.value.find((v) => v.type === forge.asn1.Type.OCTETSTRING);
  return octet ? octet.value : null;
}

function decodeMobileProvision(buffer) {
  const zip = new AdmZip(buffer);
  const entry = zip
    .getEntries()
    .find((e) => e.entryName.endsWith("/embedded.mobileprovision"));
  if (!entry) return null;
  const der = entry.getData();
  const asn1 = forge.asn1.fromDer(der.toString("binary"));
  return extractEcontent(asn1);
}

export function analyzeIpa(buffer) {
  const result = {
    otaReady: null,
    provisioning: null,
  };
  if (!buffer || !buffer.length) return result;
  try {
    const plistBytes = decodeMobileProvision(buffer);
    if (!plistBytes) return result;
    const parsed = parsePlist(plistBytes);
    const getTaskAllow = parsed.Entitlements?.["get-task-allow"];
    const devices = Array.isArray(parsed.ProvisionedDevices)
      ? parsed.ProvisionedDevices
      : [];
    let type = "Unknown";
    if (parsed.ProvisionsAllDevices === true) {
      type = "Enterprise";
    } else if (getTaskAllow === false) {
      type = "Ad Hoc";
    } else if (getTaskAllow === true) {
      type = "Development";
    }
    result.provisioning = {
      name: parsed.Name || null,
      type,
      getTaskAllow: getTaskAllow ?? null,
      appIdentifier: parsed.ApplicationIdentifier || parsed.Entitlements?.["application-identifier"] || null,
      bundleIdentifier: parsed.Entitlements?.["application-identifier"]?.replace(/^[^.]+\./, "") || null,
      teamIdentifier: parsed.TeamIdentifier?.[0] || null,
      deviceCount: devices.length,
      devices: devices.slice(0, 10),
      expirationDate: parsed.ExpirationDate ? parsed.ExpirationDate.toISOString() : null,
      provisionsAllDevices: parsed.ProvisionsAllDevices === true,
    };
    result.otaReady = getTaskAllow === false;
  } catch (e) {
    result.provisioning = { error: e.message };
    result.otaReady = false;
  }
  return result;
}
