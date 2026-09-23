const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

function createOfficialDocx() {
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:sz w:val="23"/>
        <w:color w:val="111111"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:line="276" w:lineRule="auto" w:after="120"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
</w:styles>`;

  // Document XML reproduisant fidèlement le contrat officiel de bail SMG IMMOBILIER
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <!-- TITRE OFFICIEL DU CONTRAT -->
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:after="240"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="32"/>
          <w:u w:val="single"/>
          <w:color w:val="1A3A5C"/>
        </w:rPr>
        <w:t>CONTRAT DE BAIL D'HABITATION</w:t>
      </w:r>
    </w:p>

    <!-- ENTRE LES SOUSSIGNES -->
    <w:p>
      <w:pPr>
        <w:spacing w:before="120" w:after="140"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:b/><w:sz w:val="24"/><w:u w:val="single"/></w:rPr>
        <w:t>ENTRE-LES SOUSSIGNES</w:t>
      </w:r>
    </w:p>

    <!-- BAILLEUR -->
    <w:p>
      <w:pPr><w:spacing w:after="60"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Nom et prénom : </w:t></w:r>
      <w:r><w:t>{bailleur_nom}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:spacing w:after="60"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>CNI N° : </w:t></w:r>
      <w:r><w:t>{bailleur_cni} délivrée le {bailleur_cni_date} à {bailleur_cni_lieu}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:spacing w:after="140"/></w:pPr>
      <w:r><w:rPr><w:b/><w:i/></w:rPr><w:t>Désigné : Bailleur</w:t></w:r>
    </w:p>

    <!-- REPRESENTANT DU BAILLEUR -->
    <w:p>
      <w:pPr><w:spacing w:before="100" w:after="60"/></w:pPr>
      <w:r><w:rPr><w:b/><w:u w:val="single"/></w:rPr><w:t>Représentant du bailleur</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:spacing w:after="60"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Nom et prénom : </w:t></w:r>
      <w:r><w:t>{representant_nom}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:spacing w:after="60"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>CNI N° : </w:t></w:r>
      <w:r><w:t>{representant_cni}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:spacing w:after="80"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Téléphone : </w:t></w:r>
      <w:r><w:t>{representant_telephone}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:spacing w:after="140"/></w:pPr>
      <w:r><w:rPr><w:b/><w:i/></w:rPr><w:t>D'une part,</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:spacing w:after="100"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Et,</w:t></w:r>
    </w:p>

    <!-- LOCATAIRE -->
    <w:p>
      <w:pPr><w:spacing w:after="60"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Nom et prénom : </w:t></w:r>
      <w:r><w:rPr><w:b/><w:color w:val="1A3A5C"/></w:rPr><w:t>{titre_locataire} {nom_locataire}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:spacing w:after="60"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>CNI N° : </w:t></w:r>
      <w:r><w:t>{cni_numero} {date_lieu_cni}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:spacing w:after="60"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Tel : </w:t></w:r>
      <w:r><w:t>{telephone}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:spacing w:after="180"/></w:pPr>
      <w:r><w:rPr><w:b/><w:i/></w:rPr><w:t>Dénommé Locataire ou Résident d'autre part,</w:t></w:r>
    </w:p>

    <!-- DESIGNATION DES LIEUX -->
    <w:p>
      <w:pPr><w:jc w:val="both"/><w:spacing w:after="160"/></w:pPr>
      <w:r>
        <w:t>Le bailleur loue par la présente au locataire qui a accepté et visité les lieux dont la désignation suit : </w:t>
      </w:r>
      <w:r>
        <w:rPr><w:b/></w:rPr>
        <w:t>{designation_logement}</w:t>
      </w:r>
      <w:r>
        <w:t> sise à </w:t>
      </w:r>
      <w:r>
        <w:rPr><w:b/></w:rPr>
        <w:t>{localisation_immeuble}</w:t>
      </w:r>
      <w:r>
        <w:t> : comprenant : </w:t>
      </w:r>
      <w:r>
        <w:rPr><w:i/></w:rPr>
        <w:t>{composition_logement}.</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:pPr><w:jc w:val="both"/><w:spacing w:after="160"/></w:pPr>
      <w:r><w:rPr><w:i/></w:rPr><w:t>Il a été convenu et arrêté ce qui suit :</w:t></w:r>
    </w:p>

    <w:p>
      <w:pPr><w:jc w:val="both"/><w:spacing w:after="200"/></w:pPr>
      <w:r><w:t>{bailleur_civilite} </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>{bailleur_nom}</w:t></w:r>
      <w:r><w:t>, bailleur de </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>{nom_immeuble_complet}</w:t></w:r>
      <w:r><w:t>, située à {adresse_complete}, donne en location à </w:t></w:r>
      <w:r><w:rPr><w:b/><w:color w:val="1A3A5C"/></w:rPr><w:t>{titre_locataire} {nom_locataire}</w:t></w:r>
      <w:r><w:t>, {designation_logement} aux caractéristiques susvisées.</w:t></w:r>
    </w:p>

    <!-- ARTICLE 1 -->
    <w:p>
      <w:pPr><w:jc w:val="both"/><w:spacing w:before="120" w:after="140"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Article 1 : </w:t></w:r>
      <w:r><w:t>Le présent contrat est fait pour une durée de </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>{duree_bail}</w:t></w:r>
      <w:r><w:t>, renouvelable par tacite reconduction, qui commencera à courir à compter du </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>{date_debut}</w:t></w:r>
      <w:r><w:t> pour se terminer le </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>{date_fin}</w:t></w:r>
      <w:r><w:t>.</w:t></w:r>
    </w:p>

    <!-- ARTICLE 2 -->
    <w:p>
      <w:pPr><w:jc w:val="both"/><w:spacing w:before="120" w:after="140"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Article 2 : </w:t></w:r>
      <w:r><w:t>Le présent bail est consenti et accepté moyennant un loyer mensuel de </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>FRANCS CFA {loyer_lettres} ({loyer_mensuel})</w:t></w:r>
      <w:r><w:t>, payable trimestriellement et d'avance. Les paiements des loyers seront effectués par chèque, virement bancaire, via Orange Money ou Mobile Money, en espèces ou par tout moyen à la convenance du bailleur, à l'ordre du bailleur ou de son représentant susnommé.</w:t></w:r>
    </w:p>

    <w:p>
      <w:pPr><w:jc w:val="both"/><w:spacing w:after="140"/></w:pPr>
      <w:r><w:t>Le loyer sera payable d'avance entre les mains du représentant sus désigné. Dans le cadre de ce contrat, il s'agit de </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Monsieur {representant_nom_complet}</w:t></w:r>
      <w:r><w:t>, qui reçoit selon les instructions du BAILLEUR tous les paiements.</w:t></w:r>
    </w:p>

    <w:p>
      <w:pPr><w:jc w:val="both"/><w:spacing w:after="100"/></w:pPr>
      <w:r><w:t>De plus, le locataire s'engage à verser à l'avance et en même temps que les {duree_mois_texte} mois de loyer conclus :</w:t></w:r>
    </w:p>

    <w:p>
      <w:pPr><w:ind w:left="400"/><w:spacing w:after="60"/></w:pPr>
      <w:r><w:t>- L'équivalent de </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>{nb_mois_caution_texte} de loyer comme caution soit Francs CFA {caution_lettres} ({caution_montant})</w:t></w:r>
      <w:r><w:t> ;</w:t></w:r>
    </w:p>

    <w:p>
      <w:pPr><w:ind w:left="400"/><w:spacing w:after="120"/></w:pPr>
      <w:r><w:t>- </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Francs CFA DOUZE MILLE (12.000)</w:t></w:r>
      <w:r><w:t> pour douze (12) mois pour les frais d'utilisation/entretien du château d'eau.</w:t></w:r>
    </w:p>

    <w:p>
      <w:pPr><w:jc w:val="both"/><w:spacing w:after="140"/></w:pPr>
      <w:r><w:t>Lequel loyer pour {duree_mois_texte} mois de </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>FRANCS CFA {total_loyer_lettres} ({total_loyer_chiffres})</w:t></w:r>
      <w:r><w:t>, plus {nb_mois_caution_texte} de caution </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>FRANCS CFA {caution_lettres} ({caution_montant})</w:t></w:r>
      <w:r><w:t>, et </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Francs CFA DOUZE MILLE (12.000)</w:t></w:r>
      <w:r><w:t> pour douze (12) mois pour les frais d'utilisation/entretien du château d'eau, soit au total </w:t></w:r>
      <w:r><w:rPr><w:b/><w:color w:val="1A3A5C"/></w:rPr><w:t>Francs CFA {total_general_lettres} ({total_general_chiffres})</w:t></w:r>
      <w:r><w:t> a été entièrement réglé.</w:t></w:r>
    </w:p>

    <w:p>
      <w:pPr><w:spacing w:after="140"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>DONT QUITTANCE</w:t></w:r>
    </w:p>

    <w:p>
      <w:pPr><w:jc w:val="both"/><w:spacing w:after="140"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Al 2 : </w:t></w:r>
      <w:r><w:t>Le loyer est payable trimestriellement sur consommation après l'écoulement des premiers mois initialement payés.</w:t></w:r>
    </w:p>

    <!-- ARTICLE 3 -->
    <w:p>
      <w:pPr><w:jc w:val="both"/><w:spacing w:before="120" w:after="140"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Article 3 : </w:t></w:r>
      <w:r><w:t>La caution ne sera remboursée, que lorsque la confrontation des procès - verbaux de l'état contradictoire des lieux d'entrée et de sortie, ne font état qu'il n'existe point d'impayés d'eau, d'électricité, et de loyers et que les locaux loués ont été remis à l'état dressé lors de la conclusion du bail. En cas de dommage, la caution sera réduite en fonction des travaux nécessaires à la réfection des lieux. Le preneur devra laisser le bailleur ou son mandataire visiter les lieux chaque fois qu'il le jugera nécessaire et après qu'il ait été prévenu au moins 24 heures à l'avance. La caution exigée est relative aux équipements de la chambre. Cette caution exigible n'est en aucun cas liée à la location de la chambre.</w:t></w:r>
    </w:p>

    <!-- ARTICLE 4 -->
    <w:p>
      <w:pPr><w:jc w:val="both"/><w:spacing w:before="120" w:after="140"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Article 4 : </w:t></w:r>
      <w:r><w:t>La consommation mensuelle d'électricité et d'eau est à la charge de chaque résident. Un forfait d'eau mensuel de 1000 FCFA est exigé payable sur consommation.</w:t></w:r>
    </w:p>

    <!-- ARTICLE 5 -->
    <w:p>
      <w:pPr><w:jc w:val="both"/><w:spacing w:before="120" w:after="140"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Article 5 : </w:t></w:r>
      <w:r><w:t>Le preneur restera responsable des lieux loués, et des installations qui s'y trouvent pendant toute la période de son occupation. Tous les frais exposés par le locataire aux fins de réfection des lieux loués lui seront rétrocédés par le bailleur ou compensés sur le loyer à condition pour l'occupant d'avoir préalablement reçu un accord écrit du bailleur suite au devis a lui présenté.</w:t></w:r>
    </w:p>

    <!-- ARTICLE 6 -->
    <w:p>
      <w:pPr><w:jc w:val="both"/><w:spacing w:before="120" w:after="140"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Article 6 : </w:t></w:r>
      <w:r><w:t>En cas de non-respect des clauses du contrat, le locataire pourra se voir priver d'eau et d'électricité et le contrat pourra être résilié.</w:t></w:r>
    </w:p>

    <!-- ARTICLE 7 -->
    <w:p>
      <w:pPr><w:jc w:val="both"/><w:spacing w:before="120" w:after="140"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Article 7 : </w:t></w:r>
      <w:r><w:t>Le preneur doit respecter les règles d'hygiène et de salubrité publique et satisfera à toutes les prescriptions légales du bailleur, de la Police, et de la voirie.</w:t></w:r>
    </w:p>

    <!-- ARTICLE 8 -->
    <w:p>
      <w:pPr><w:jc w:val="both"/><w:spacing w:before="120" w:after="140"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Article 8 : </w:t></w:r>
      <w:r><w:t>Le preneur s'acquittera des impôts et droits d'enregistrement pouvant exister ou être établis en raison de son occupation des lieux. En particulier, il sera tenu pour responsable du payement dans les délais des droits d'enregistrement dus à l'établissement du présent contrat ainsi qu'à chaque renouvellement conformément à la réglementation en vigueur et devra justifier le paiement de ces droits par la remise des photocopies des quittances de paiement au Bailleur. Non compris sont les précomptes sur loyers qui seront réglés directement auprès du Trésor par le BAILLEUR.</w:t></w:r>
    </w:p>

    <!-- ARTICLE 9 -->
    <w:p>
      <w:pPr><w:jc w:val="both"/><w:spacing w:before="120" w:after="140"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Article 9 : </w:t></w:r>
      <w:r><w:t>Le locataire qui entend résilier le contrat au cours de la première échéance trimestrielle uniquement perd la rétrocession du quart de sa caution locative mais se verra restituer l'intégralité des loyers payés mais non consommés, ainsi que le solde de sa caution. Le locataire se verra restituer l'entièreté de sa caution en cas de résiliation du contrat après consommation de la première échéance trimestrielle.</w:t></w:r>
    </w:p>

    <!-- ARTICLE 10 -->
    <w:p>
      <w:pPr><w:jc w:val="both"/><w:spacing w:before="120" w:after="240"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Article 10 : </w:t></w:r>
      <w:r><w:t>Le locataire est tenu au respect du règlement intérieur et au paiement de son loyer.</w:t></w:r>
    </w:p>

    <!-- DATE ET SIGNATURES -->
    <w:p>
      <w:pPr><w:spacing w:before="240" w:after="240"/></w:pPr>
      <w:r><w:t>Fait à {ville_signature}, le </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>{date_signature}</w:t></w:r>
    </w:p>

    <w:table>
      <w:tblPr>
        <w:tblW w:w="9200" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/>
          <w:insideH w:val="none"/><w:insideV w:val="none"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="4600" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>LE BAILLEUR</w:t></w:r>
          </w:p>
          <w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>
          <w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>
          <w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>
          <w:p>
            <w:r><w:rPr><w:i/><w:sz w:val="20"/></w:rPr><w:t>Pour le Bailleur : {representant_nom}</w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="4600" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>LE LOCATAIRE</w:t></w:r>
          </w:p>
          <w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>
          <w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>
          <w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>
          <w:p>
            <w:r><w:rPr><w:i/><w:sz w:val="20"/></w:rPr><w:t>Signature précédée de la mention « lu et approuvé »</w:t></w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:table>
  </w:body>
</w:document>`;

  const zip = new PizZip();
  zip.file('[Content_Types].xml', contentTypesXml);
  zip.file('_rels/.rels', relsXml);
  zip.file('word/_rels/document.xml.rels', docRelsXml);
  zip.file('word/document.xml', documentXml);
  zip.file('word/styles.xml', stylesXml);

  const buffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  const templatesDir = path.join(__dirname, '..', 'templates');
  if (!fs.existsSync(templatesDir)) fs.mkdirSync(templatesDir, { recursive: true });

  const targetPath = path.join(templatesDir, 'modele_contrat_bail_smg.docx');
  fs.writeFileSync(targetPath, buffer);
  console.log('✅ Modèle Word officiel fidèle généré avec succès :', targetPath, 'Taille:', buffer.length);
  return targetPath;
}

createOfficialDocx();
