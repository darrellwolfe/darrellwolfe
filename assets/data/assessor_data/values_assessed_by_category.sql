Select
i.RevObjId AS lrsn,
c.FullGroupCode,
SUM(c.ValueAmount) AS CadValue_ByCat
FROM CadRoll r
JOIN CadLevel l ON r.Id = l.CadRollId
JOIN CadInv i ON l.Id = i.CadLevelId
JOIN tsbv_cadastre AS c 
  On c.CadRollId = r.Id
  And c.CadInvId = i.Id
  And c.ValueType = 470 -- Variable
WHERE r.AssessmentYear = Year(GetDate()) - 1
GROUP BY i.RevObjId, c.FullGroupCode


-- By Cat Options
 
 
  /*
  -- Improvement
  AND c.FullGroupCode IN (
      '25', '26', '26H', '27', '30', '31H', '32', '33', '34H', '35', '36', '37H', '38', '39', '41H', '42', '43', '45', 
      '46H', '47H', '48H', '49H', '50H', '51', '51P', '55H', '56P', '56Q', '56Q2', '56Q3', '57P', '58P', '58Q', '58Q2', 
      '58Q3', '58Q4', '59P', '59Q', '59Q2', '59Q3', '59Q4', '63P', '63Q', '63Q2', '63Q3', '63Q4', '65H', '66P', '67', 
      '67L', '67P', '68P', '68Q', '68Q2', '68Q3', '68Q4', '69P', '69Q', '69Q2', '69Q3', '69Q4', '70P', '71P', '71Q', 
      '71Q2', '71Q3', '71Q4', '72P', '72Q', '72Q2', '72Q3', '72Q4', '75P', '81', '81P')
*/

  /*
  -- Land
  AND c.FullGroupCode IN (
      '01', '03', '04', '05', '06', '07', '09', '10', '10H', '11', '12', '12H', '13', '14', '15', '15H', '16', '17', 
      '18', '19', '20', '20H', '21', '22', '25L', '26LH', '27L', '81L')
*/

/*
Declare @ValueTypehoex INT = 305;
--    305 HOEX_Exemption Homeowner Exemption
Declare @ValueTypeimp INT = 103;
--    103 Imp Assessed Improvement Assessed
Declare @ValueTypeland INT = 102;
--    102 Land Assessed Land Assessed
Declare @ValueTypetotal INT = 109;
--    109 Total Value Total Value
Declare @NetTaxableValueImpOnly INT = 458;
--    458 Net Imp Only Net Taxable Value Imp Only
Declare @NetTaxableValueTotal INT = 455;
--    455 Net Tax Value Net Taxable Value
Declare @NewConstruction INT = 651;
--    651 NewConstByCat New Construction
Declare @AssessedByCat INT = 470;
--    470 AssessedByCat Assessed Value
*/
