SELECT DISTINCT
i.RevObjId AS lrsn,
    CASE
        WHEN pmd.neighborhood >= 9000 THEN 'Manufactured Homes'
        WHEN pmd.neighborhood >= 6003 THEN 'District 6'
        WHEN pmd.neighborhood = 6002 THEN 'Manufactured Homes'
        WHEN pmd.neighborhood = 6001 THEN 'District 6'
        WHEN pmd.neighborhood = 6000 THEN 'Manufactured Homes'
        WHEN pmd.neighborhood >= 5003 THEN 'District 5'
        WHEN pmd.neighborhood = 5002 THEN 'Manufactured Homes'
        WHEN pmd.neighborhood = 5001 THEN 'District 5'
        WHEN pmd.neighborhood = 5000 THEN 'Manufactured Homes'
        WHEN pmd.neighborhood >= 4000 THEN 'District 4'
        WHEN pmd.neighborhood >= 3000 THEN 'District 3'
        WHEN pmd.neighborhood >= 2000 THEN 'District 2'
        WHEN pmd.neighborhood >= 1021 THEN 'District 1'
        WHEN pmd.neighborhood = 1020 THEN 'Manufactured Homes'
        WHEN pmd.neighborhood >= 1001 THEN 'District 1'
        WHEN pmd.neighborhood = 1000 THEN 'Manufactured Homes'
        WHEN pmd.neighborhood >= 451 THEN 'Commercial'
        WHEN pmd.neighborhood = 450 THEN 'Personal Property'
        WHEN pmd.neighborhood >= 1 THEN 'Commercial'
        WHEN pmd.neighborhood = 0 THEN 'PP_N/A or Error'
        ELSE NULL
    END AS District,
pmd.neighborhood AS GEO,
TRIM(pmd.NeighborHoodName) AS GEO_Name,
Case
    When pmd.pin Like 'A%' Then 'Athol'         -- Athol
    When pmd.pin Like 'C%' Then 'CoeurdAlene'          -- Coeur d’Alene
    When pmd.pin Like 'D%' Then 'Dalton_Gardens'         -- Dalton Gardens
    When pmd.pin Like 'H%' Then 'Hayden'         -- Hayden
    When pmd.pin Like 'V%' Then 'Hayden_Lake'         -- Hayden Lake
    When pmd.pin Like 'P%' Then 'Post_Falls'           -- Post Falls
    When pmd.pin Like 'R%' Then 'Rathdrum'         -- Rathdrum
    When pmd.pin Like 'S%' Then 'Spirit_Lake'         -- Spirit Lake
    When pmd.pin Like 'X%' Then 'Hauser'       -- Hauser
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

TRIM(pmd.pin) AS PIN,
TRIM(pmd.AIN) AS AIN,
r.AssessmentYear AS AssessmentYear_TenYear,
CAST(CONCAT('01/01/',r.AssessmentYear) AS DATE) AS AppraisalDate,
SUM(c.ValueAmount) AS AssessedValue

FROM CadRoll r
JOIN CadLevel l ON r.Id = l.CadRollId
JOIN CadInv i ON l.Id = i.CadLevelId
JOIN tsbv_cadastre AS c 
  On c.CadRollId = r.Id
  And c.CadInvId = i.Id
  And c.ValueType = 109 -- 109 Total Value Total Value

JOIN parceltableview AS pmd ON i.RevObjId=pmd.lrsn
  AND pmd.EffStatus = 'A'
  AND pmd.neighborhood <> 0

WHERE r.AssessmentYear BETWEEN Year(GetDate()) - 10 AND Year(GetDate())
Group By i.RevObjId, r.AssessmentYear,
pmd.neighborhood, pmd.NeighborHoodName, pmd.pin, pmd.AIN

/*
Declare @ValueTypetotal INT = 109;
-- 109 Total Value Total Value

Declare @NetTaxableValueTotal INT = 455;
-- 455 Net Tax Value Net Taxable Value

Declare @ValueTypehoex INT = 305;

Declare @ValueTypeimp INT = 103;
-- 103 Imp Assessed Improvement Assessed
Declare @ValueTypeland INT = 102;
-- 102 Land Assessed Land Assessed
Declare @NetTaxableValueImpOnly INT = 458;
-- 458 Net Imp Only Net Taxable Value Imp Only

Declare @NewConstruction INT = 651;
-- 651 NewConstByCat New Construction
Declare @AssessedByCat INT = 470;
-- 470 AssessedByCat Assessed Value
*/
