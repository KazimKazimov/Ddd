function export_example(outFile)
% EXPORT_EXAMPLE  Write the optimizer's data file from MATLAB tables.
%   export_example('data/private/universe.json')
%
% Replace the four tables below with your own. The format is in docs/DATA_SCHEMA.md.
%   bonds     : table with id, name, country, type, rating, maturity, coupon, price, yield,
%               spread (bp), duration, spreadDuration, indexWeight (%), portfolioWeight (%)
%   scen      : table with id, scenario, prob, ret   (1 to 4 rows per bond; ret = 12-month return, %)
%   covCodes  : cellstr of country codes;  covMat : covariance of RELATIVE spread changes,
%               annualised, in decimals (0.09 = 30% volatility)
%   countries : table with code, name, region, rating
%   macroRet  : optional, nBonds x nFactors, return in % for a +1 std move; macroNames, macroStd cellstr

error('Fill in the tables below, then delete this line.');
bonds = table(); scen = table(); countries = table(); covCodes = {}; covMat = [];
macroRet = []; macroNames = {}; macroStd = {};

n = height(bonds); B = cell(n,1);
for i = 1:n
    s = scen(strcmp(scen.id, bonds.id{i}), :);
    sc = cell(height(s),1);
    for j = 1:height(s)
        sc{j} = struct('name', s.scenario{j}, 'prob', s.prob(j), 'ret', s.ret(j));
    end
    b = struct('id', bonds.id{i}, 'name', bonds.name{i}, 'country', bonds.country{i}, ...
        'type', bonds.type{i}, 'rating', bonds.rating{i}, 'maturity', bonds.maturity(i), ...
        'coupon', bonds.coupon(i), 'price', bonds.price(i), 'yield', bonds.yield(i), ...
        'spread', bonds.spread(i), 'duration', bonds.duration(i), 'spreadDuration', bonds.spreadDuration(i), ...
        'indexWeight', bonds.indexWeight(i), 'portfolioWeight', bonds.portfolioWeight(i));
    b.scenarios = sc;                       % a cell array encodes as a JSON list even with one scenario
    if ~isempty(macroRet), b.macro = num2cell(macroRet(i,:)); end
    B{i} = b;
end
C = cell(height(countries),1);
for i = 1:height(countries)
    C{i} = struct('code', countries.code{i}, 'name', countries.name{i}, 'region', countries.region{i}, 'rating', countries.rating{i});
end
F = cell(numel(macroNames),1);
for i = 1:numel(macroNames), F{i} = struct('name', macroNames{i}, 'std', macroStd{i}, 'tip', ''); end

D = struct();
D.meta = struct('name', 'EMD universe', 'asOf', datestr(today, 'yyyy-mm-dd'), 'horizonMonths', 12);
D.settings = struct('costBaseBp', 30, 'sofr', 3.9, 'navMio', 5000);
D.regions = {{'Latin America', 'Europe & Central Asia', 'Middle East', 'Africa', 'Asia'}};
D.countries = C;
D.bonds = B;
D.risk = struct('countryCov', struct('codes', {covCodes}, 'matrix', covMat), ...
    'typeLoading', [1 1 1], 'typeResidualVol', [0.04 0.10 0.16]);
D.macro = struct('factors', {F});

fid = fopen(outFile, 'w', 'n', 'UTF-8'); fwrite(fid, jsonencode(D), 'char'); fclose(fid);
fprintf('wrote %s\n', outFile);
end
