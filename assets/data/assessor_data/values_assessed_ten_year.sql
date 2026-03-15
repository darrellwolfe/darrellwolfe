Select Distinct
i.RevObjId As lrsn,
Case
  When pmd.neighborhood >= 9000 Then 'Manufactured Homes'
  When pmd.neighborhood >= 6003 Then 'District 6'
  When pmd.neighborhood = 6002 Then 'Manufactured Homes'
  When pmd.neighborhood = 6001 Then 'District 6'
  When pmd.neighborhood = 6000 Then 'Manufactured Homes'
  When pmd.neighborhood >= 5003 Then 'District 5'
  When pmd.neighborhood = 5002 Then 'Manufactured Homes'
  When pmd.neighborhood = 5001 Then 'District 5'
  When pmd.neighborhood = 5000 Then 'Manufactured Homes'
  When pmd.neighborhood >= 4000 Then 'District 4'
  When pmd.neighborhood >= 3000 Then 'District 3'
  When pmd.neighborhood >= 2000 Then 'District 2'
  When pmd.neighborhood >= 1021 Then 'District 1'
  When pmd.neighborhood = 1020 Then 'Manufactured Homes'
  When pmd.neighborhood >= 1001 Then 'District 1'
  When pmd.neighborhood = 1000 Then 'Manufactured Homes'
  When pmd.neighborhood >= 451 Then 'Commercial'
  When pmd.neighborhood = 450 Then 'Personal Property'
  When pmd.neighborhood >= 1 Then 'Commercial'
  When pmd.neighborhood = 0 Then 'PP_N/A or Error'
  Else Null
End As District,
pmd.neighborhood As GEO,
Trim(pmd.NeighborHoodName) As GEO_Name,
Case
  When pmd.pin Like 'A%' Then 'Athol' -- Athol
  When pmd.pin Like 'C%' Then 'CoeurdAlene' -- Coeur d'Alene
  When pmd.pin Like 'D%' Then 'Dalton_Gardens' -- Dalton Gardens
  When pmd.pin Like 'H%' Then 'Hayden' -- Hayden
  When pmd.pin Like 'V%' Then 'Hayden_Lake' -- Hayden Lake
  When pmd.pin Like 'P%' Then 'Post_Falls' -- Post Falls
  When pmd.pin Like 'R%' Then 'Rathdrum' -- Rathdrum
  When pmd.pin Like 'S%' Then 'Spirit_Lake' -- Spirit Lake
  When pmd.pin Like 'X%' Then 'Hauser' -- Hauser
  When pmd.pin Like 'F%' Then 'Fernan Lake Village'
  When pmd.pin Like 'B%' Then 'Bayview'
  When pmd.pin Like 'T%' Then 'Stateline'
  When pmd.pin Like 'U%' Then 'Huetter'
  When pmd.pin Like 'W%' Then 'Worley'
  When pmd.pin Like 'Y%' Then 'Harrison'
  When pmd.pin Like 'E%' Then 'Business Personal Property'
  When pmd.pin Like 'G%' Then 'Cable TV'
  When pmd.pin Like 'KC-%' Then 'Test Parcels'
  When pmd.pin Like 'M%' Then 'Mobile Homes'
  When pmd.pin Like '0%' Then 'Kootenai County'
  When pmd.pin Like '5%' Then 'Kootenai County'
  When pmd.pin Like '4%' Then 'Kootenai County'
  When pmd.pin Like 'UP%' Then 'Operating Property'
  When pmd.pin Like 'L%' Then 'Float Homes'
  Else 'UNKNOWN'
End As PIN_City,
Trim(pmd.pin) As PIN,
Trim(pmd.AIN) As AIN,
r.AssessmentYear As AssessmentYear_TenYear,
Cast(Concat('01/01/', r.AssessmentYear) As Date) As AppraisalDate,
Sum(c.ValueAmount) As AssessedValue

From CadRoll r
Join CadLevel l On r.Id = l.CadRollId
Join CadInv i On l.Id = i.CadLevelId
Join tsbv_cadastre As c
  On c.CadRollId = r.Id
  And c.CadInvId = i.Id
  And c.ValueType = 109 -- 109 Total Value Total Value
Join parceltableview As pmd On i.RevObjId = pmd.lrsn
  And pmd.EffStatus = 'A'
  And pmd.neighborhood <> 0

Where r.AssessmentYear Between Year(GetDate()) - 10 And Year(GetDate())

Group By
i.RevObjId,
r.AssessmentYear,
pmd.neighborhood,
pmd.NeighborHoodName,
pmd.pin,
pmd.AIN

/*
Declare @ValueTypetotal Int = 109;
-- 109 Total Value Total Value

Declare @NetTaxableValueTotal Int = 455;
-- 455 Net Tax Value Net Taxable Value

Declare @ValueTypehoex Int = 305;

Declare @ValueTypeimp Int = 103;
-- 103 Imp Assessed Improvement Assessed
Declare @ValueTypeland Int = 102;
-- 102 Land Assessed Land Assessed
Declare @NetTaxableValueImpOnly Int = 458;
-- 458 Net Imp Only Net Taxable Value Imp Only

Declare @NewConstruction Int = 651;
-- 651 NewConstByCat New Construction
Declare @AssessedByCat Int = 470;
-- 470 AssessedByCat Assessed Value
*/
