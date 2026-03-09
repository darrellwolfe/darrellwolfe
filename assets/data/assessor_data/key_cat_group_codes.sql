Select 
c.tbl_element AS Cat_Group_Code,
c.tbl_element_desc AS Cat_Description
From codes_table AS c
    --On a.group_code = c.tbl_element
Where c.code_status = 'A' 
  And tbl_type_code= 'impgroup'
