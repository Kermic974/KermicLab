import json, re
from fractions import Fraction as F
def load(n): return json.load(open(f"catalogue/{n}/contenu.json", encoding="utf-8"))
def save(n, d): open(f"catalogue/{n}/contenu.json","w",encoding="utf-8").write(json.dumps(d, ensure_ascii=False, indent=2)+"\n")
def nb(titre, q, r, indices, sol, **kw):
    d={"type":"nombre","titre":titre,"question":q,"reponse":r}
    d.update(kw); d["indices"]=indices; d["solution"]=sol
    return {k:d[k] for k in ["type","titre","question","reponse","unite","tolerance","indices","solution"] if k in d}
def qcm(titre,q,choix,bonne,expl,indice=None):
    d={"type":"qcm","titre":titre,"question":q,"choix":choix,"bonne":bonne,"explication":expl}
    if indice: d["indice"]=indice
    return d
def niv(titre, niveau, paras, exemple=None, ar=None):
    d={"titre":titre,"niveau":niveau,"paragraphes":paras}
    if exemple: d["exemple"]={"titre":exemple[0],"etapes":exemple[1]}
    if ar: d["aRetenir"]=ar
    return d

# ---------- puissances
assert 2**10==1024 and 1024*0.1==102.4 and (-2)**3==-8 and -2**4==-16 and (-2)**4==16
assert 5**2==25 and 3**3==27 and 3*2==6 and 3*10**4*2*10**3==6*10**7 and 4*10**5*5*10**2==2*10**8
assert 2**7//2**4==8 and (2**3)**2==64 and F(1,2**3)==F(125,1000) and 6.3e-2==0.063
assert 0.00007==7e-5 and 3e5==300000 and 2**6==64 and 5**-2==0.04 and 4.5e-4==0.00045 and (-3)**2==9 and -3**2==-9
d=load("puissances")
n=d["niveaux"]
n[0]["paragraphes"]+=["Les puissances sont partout dans la vie courante : une rumeur que chaque personne répète à 2 amis touche 2, puis 4, puis 8, puis 16 personnes… Les téléphones, les jeux vidéo et les ordinateurs, qui comptent en 0 et en 1, utilisent sans cesse les puissances de 2."]
n[0]["exemple"]={"titre":"Exemple : une feuille pliée 10 fois (en théorie !)","etapes":["Chaque pli double le nombre d'épaisseurs : 2, 4, 8, 16, 32, 64, 128, 256, 512, 1 024.","Après 10 plis, il y a 2¹⁰ = 1 024 épaisseurs.","Si une feuille fait 0,1 mm d'épaisseur, la pile mesure 1 024 × 0,1 = 102,4 mm, soit environ 10 cm."]}
n[0]["aRetenir"]="aⁿ signifie « a multiplié par lui-même n fois ». L'exposant compte les multiplications : il ne se multiplie pas avec a."
n[1]["paragraphes"]+=["Dans la vie courante : un carrelage carré de 5 m de côté couvre 5² = 25 m², et un dé de 3 cm d'arête a un volume de 3³ = 27 cm³."]
n[1]["exemple"]={"titre":"Exemple : (−2)³, −2⁴ et (−2)⁴","etapes":["(−2)³ = (−2) × (−2) × (−2) = 4 × (−2) = −8.","−2⁴ = −(2 × 2 × 2 × 2) = −16 : l'exposant ne s'applique qu'au 2.","(−2)⁴ = (−2) × (−2) × (−2) × (−2) = 16 : avec des parenthèses, le signe moins est multiplié aussi."]}
n[1]["aRetenir"]="Sans parenthèses, l'exposant ne s'applique qu'au nombre placé juste avant lui. Une puissance paire d'un nombre négatif est positive, une puissance impaire est négative."
n[2]["paragraphes"]+=["Tu les croises tous les jours : 1 km = 10³ m (« kilo » veut dire mille), 1 mm = 10⁻³ m (« milli » veut dire millième) et 1 Go (gigaoctet) = 10⁹ octets. Les préfixes du système métrique sont des puissances de 10."]
n[2]["exemple"]={"titre":"Exemple : écrire 6,3 × 10⁻² en décimal","etapes":["10⁻² = 0,01, donc 6,3 × 10⁻² = 6,3 ÷ 100.","Diviser par 100, c'est décaler la virgule de 2 rangs vers la gauche.","6,3 × 10⁻² = 0,063."]}
n[2]["aRetenir"]="Un exposant négatif ne rend pas le nombre négatif : 10⁻³ = 0,001 est un très petit nombre positif."
n[3]["paragraphes"]+=["Autres exemples : la lumière parcourt environ 300 000 km en une seconde, soit 3 × 10⁵ km/s, et un cheveu mesure environ 0,000 07 m de diamètre, soit 7 × 10⁻⁵ m. Les calculatrices affichent souvent ces nombres avec la lettre E : 1,5E8 veut dire 1,5 × 10⁸."]
n[3]["aRetenir"]="Dans a × 10ⁿ : a est compris entre 1 et 10, et |n| compte le nombre de rangs dont on décale la virgule. n est positif pour un grand nombre et négatif pour un nombre très petit."
n[4]["exemple"]={"titre":"Exemple : trois calculs avec les règles","etapes":["2⁷ ÷ 2⁴ = 2⁷⁻⁴ = 2³ = 8.","(2³)² = 2³ˣ² = 2⁶ = 64.","2⁻³ = 1/2³ = 1/8 = 0,125."]}
n.append(niv("Calculer en notation scientifique","3e / seconde",["Pour multiplier deux nombres écrits en notation scientifique, on multiplie les nombres devant, et on additionne les exposants des puissances de 10.","Cela sert à calculer avec de très grands ou de très petits nombres sans compter les zéros : tailles d'atomes, distances entre étoiles, quantité de données sur internet…"],
 ("Exemple : (3 × 10⁴) × (2 × 10³) et (4 × 10⁵) × (5 × 10²)",["Premier calcul : 3 × 2 = 6 et 10⁴ × 10³ = 10⁷, donc le résultat est 6 × 10⁷.","Deuxième calcul : 4 × 5 = 20 et 10⁵ × 10² = 10⁷, donc le résultat est 20 × 10⁷.","Mais 20 n'est pas compris entre 1 et 10 : 20 × 10⁷ = 2 × 10 × 10⁷ = 2 × 10⁸."]),
 "Après le calcul, vérifie que le nombre devant la puissance de 10 est bien entre 1 et 10 ; sinon, ajuste l'exposant."))
ex=d["application"]["exercices"]
ex+=[qcm("Le piège du signe","Que vaut −3² ?",["−9","9","−6"],0,"Sans parenthèses, l'exposant ne s'applique qu'au 3 : −3² = −(3 × 3) = −9. C'est (−3)² qui vaut 9.","Compare −3² et (−3)² : où sont les parenthèses ?"),
 nb("Quotient de puissances","2⁷ ÷ 2⁴ = 2ⁿ. Combien vaut n ?",3,["Quand on divise des puissances du même nombre, on soustrait les exposants."],"2⁷ ÷ 2⁴ = 2⁷⁻⁴ = 2³ (= 8), donc n = 3."),
 nb("Écrire un petit nombre","Écris 0,00045 sous la forme 4,5 × 10ⁿ. Combien vaut n ?",-4,["Combien de rangs faut-il décaler la virgule vers la droite pour passer de 0,00045 à 4,5 ?","C'est 4 rangs : comme le nombre est très petit, l'exposant est négatif."],"On décale la virgule de 4 rangs vers la droite : 0,00045 = 4,5 × 10⁻⁴, donc n = −4."),
 nb("Un exposant négatif","Calcule 5⁻² sous forme décimale.",0.04,["5⁻² = 1/5²."," 5² = 25, puis calcule 1 ÷ 25."],"5⁻² = 1/5² = 1/25 = 0,04.")]
for e in ex[-1:]: e["indices"]=[i.strip() for i in e["indices"]]
s=d["situation"]
s["histoire"]=["Dans un laboratoire, une bactérie est placée dans une boîte de culture, au chaud, avec de quoi manger. Toutes les **20 minutes**, chaque bactérie se divise en **deux**.","Le nombre de bactéries est donc multiplié par 2 toutes les 20 minutes. Au début, cela paraît minuscule : 2, puis 4, puis 8… Mais les puissances réservent des surprises.","C'est ce qui rend certaines infections si rapides, et ce qui explique pourquoi on garde les aliments au frais. À toi de calculer : combien seront-elles après quelques heures ?"]
s["etapes"].insert(1,nb("Au bout de 2 heures","Et au bout de 2 heures ?",64,["2 heures = 120 minutes = 6 périodes de 20 minutes.","Calcule 2⁶."],"6 divisions : 2⁶ = 64 bactéries.",unite="bactéries"))
s["conclusion"]="Bravo ! En 3 heures, on passe de 1 bactérie à 512, et en 10 heures à plus d'un milliard. Une croissance qui double à chaque étape s'emballe très vite : c'est la croissance exponentielle, que tu retrouveras au lycée. Les puissances de 10 et la notation scientifique permettent de noter ces nombres géants sans compter les zéros."
assert len(ex)==10 and len(s["etapes"])==5
save("puissances",d)

# ---------- statistiques
assert (18+21+15)/3==18 and (10+2*16)/3==14
assert sorted([150,162,158,171,149,165])[2:4]==[158,162] and (158+162)/2==160
assert 12+9+9==30 and 12/30==.4 and 9/30==.3
s_=[1,3,4,6,7,9,10,12]; assert s_[1]==3 and s_[5]==9 and (6+7)/2==6.5
d=load("statistiques"); n=d["niveaux"]
n[0]["paragraphes"]+=["Tu en rencontres tout le temps : la moyenne de ton bulletin, la température moyenne d'un mois, le résultat d'un sondage… Attention : la moyenne n'est pas forcément une valeur de la série. Une famille peut avoir 2,3 enfants en moyenne, alors qu'aucune famille n'a 2,3 enfants !"]
n[0]["exemple"]={"titre":"Exemple : trois températures","etapes":["Trois jours de suite, il fait 18 °C, 21 °C et 15 °C.","Somme : 18 + 21 + 15 = 54.","Moyenne : 54 ÷ 3 = 18, soit 18 °C."]}
n[0]["aRetenir"]="Une moyenne résume une série entière en un seul nombre : on additionne tout, puis on partage équitablement."
n[1]["paragraphes"]+=["Dans la vie courante, un contrôle de coefficient 3 pèse trois fois plus qu'une interrogation de coefficient 1. Avec 10 (coefficient 1) et 16 (coefficient 2) : (10 + 2 × 16) ÷ 3 = 42 ÷ 3 = 14."]
n[1]["aRetenir"]="La moyenne est toujours comprise entre la plus petite et la plus grande valeur de la série. Si ton calcul sort de cet intervalle, il y a une erreur !"
n[2]["exemple"]={"titre":"Exemple : les tailles 150, 162, 158, 171, 149 et 165 cm","etapes":["On range dans l'ordre croissant : 149 ; 150 ; 158 ; 162 ; 165 ; 171.","Il y a 6 valeurs (effectif pair) : les deux valeurs du milieu sont 158 et 162.","Médiane : (158 + 162) ÷ 2 = 160 cm. La moitié du groupe mesure moins de 160 cm, l'autre moitié plus."]}
n[3]["exemple"]={"titre":"Exemple : le moyen de transport de 30 élèves","etapes":["12 élèves prennent le bus, 9 viennent à vélo et 9 viennent à pied : 12 + 9 + 9 = 30.","Fréquence du bus : 12 ÷ 30 = 0,4 = 40 %. Vélo et pied : 9 ÷ 30 = 0,3 = 30 % chacun.","Vérification : 40 % + 30 % + 30 % = 100 %."]}
n[3]["aRetenir"]="Fréquence = effectif ÷ effectif total. En pourcentage : multiplie par 100. Le total des fréquences doit toujours faire 100 %."
n[4]["paragraphes"]+=["Dans la vie courante, on s'en sert pour comparer des groupes : les courbes de croissance du carnet de santé utilisent des médianes et des quartiles, et les diagrammes « boîtes à moustaches » les dessinent."]
n[4]["exemple"]={"titre":"Exemple : la série 1 ; 3 ; 4 ; 6 ; 7 ; 9 ; 10 ; 12","etapes":["Il y a 8 valeurs déjà rangées. 25 % de 8 = 2 : Q1 est la 2e valeur, soit 3.","75 % de 8 = 6 : Q3 est la 6e valeur, soit 9.","Écart interquartile : Q3 − Q1 = 9 − 3 = 6. La médiane, elle, vaut (6 + 7) ÷ 2 = 6,5."]}
n[4]["aRetenir"]="Moyenne et écart type vont ensemble ; médiane et quartiles vont ensemble. Les seconds sont moins sensibles aux valeurs extrêmes."
ex=d["application"]["exercices"]
sor=sorted([3,12,5,100,8,6,9]); assert sor[3]==8
ex+=[nb("Moyenne pondérée","Un élève a 10 à un devoir de coefficient 1 et 14 à un devoir de coefficient 3. Quelle est sa moyenne ?",13,["Le 14 compte trois fois : (10 + 3 × 14) ÷ …","Le total des coefficients est 1 + 3 = 4."],"(10 + 3 × 14) ÷ 4 = (10 + 42) ÷ 4 = 52 ÷ 4 = 13."),
 nb("Retrouver la somme","La moyenne de 5 températures est 14 °C. Quelle est la somme de ces 5 températures ?",70,["Moyenne = somme ÷ effectif, donc somme = moyenne × effectif."],"Somme = 14 × 5 = 70 °C.",unite="°C"),
 nb("Médiane et valeur extrême","Trouve la médiane de 3 ; 12 ; 5 ; 100 ; 8 ; 6 ; 9.",8,["Range d'abord : 3 ; 5 ; 6 ; 8 ; 9 ; 12 ; 100.","Il y a 7 valeurs : cherche la 4e."],"Rangée : 3 ; 5 ; 6 ; 8 ; 9 ; 12 ; 100. La 4e valeur sur 7 est 8. La valeur extrême 100 n'y change rien."),
 nb("Écart interquartile","Pour la série 1 ; 3 ; 4 ; 6 ; 7 ; 9 ; 10 ; 12 (8 valeurs), Q1 est la 2e valeur et Q3 la 6e. Calcule l'écart interquartile Q3 − Q1.",6,["Q1 = 3 (2e valeur).","Q3 = 9 (6e valeur)."],"Q1 = 3 et Q3 = 9, donc Q3 − Q1 = 9 − 3 = 6.")]
s=d["situation"]
s["histoire"]=["Léo a eu **12, 8, 15 et 13** à ses quatre premiers contrôles de maths (tous de coefficient 1).","Il voudrait savoir où il en est, et ce qu'il lui faut pour progresser avant le conseil de classe. Ses parents lui ont demandé : « Tu es au-dessus de la moyenne de la classe ? »","Pour répondre, il va devoir calculer des moyennes, des médianes, et même prévoir une note à atteindre. Aide-le !"]
assert sorted([12,8,15,13])==[8,12,13,15] and (12+13)/2==12.5 and max(12,8,15,13,16)-min(12,8,15,13,16)==8
et=s["etapes"]
et.insert(1,nb("La médiane de ses notes","Quelle est la médiane des notes 12, 8, 15 et 13 ?",12.5,["Range : 8 ; 12 ; 13 ; 15.","Fais la moyenne des deux valeurs du milieu."],"Rangée : 8 ; 12 ; 13 ; 15. Médiane : (12 + 13) ÷ 2 = 12,5."))
et.append(nb("L'étendue de ses cinq notes","Avec le 5e devoir à 16, les notes sont 12, 8, 15, 13 et 16. Quelle est leur étendue ?",8,["Étendue = plus grande valeur − plus petite valeur."],"16 − 8 = 8 : les notes de Léo varient sur 8 points."))
s["conclusion"]="Bien joué ! Tu sais maintenant calculer une moyenne, même pondérée, trouver une médiane, mesurer une étendue et prévoir la note qu'il te faut : très utile pour tes propres bulletins. Retiens que chaque indicateur raconte une partie de l'histoire : la moyenne résume, la médiane résiste aux notes extrêmes, l'étendue montre la régularité."
assert len(ex)==10 and len(et)==5
save("statistiques",d)

# ---------- probabilites
assert F(4,32)==F(1,8) and F(2,5)*F(3,5)==F(6,25) and 6/25==.24 and 1-F(25,36)==F(11,36) and round(11/36,2)==.31
assert F(5,8)==1-F(3,8) and 96/600==.16 and round(1/6,3)==.167 and 600/6==100 and 100-4==96
assert sum(1 for a in range(1,7) for b in range(1,7) if a+b==10)==3 and round(3/36,4)==.0833
assert F(15,20)==F(3,4) and 300/6==50 and F(1,2)**2==F(1,4) and F(1,2)*F(1,6)==F(1,12) and F(4,8)==F(1,2)
d=load("probabilites"); n=d["niveaux"]
n[0]["paragraphes"]+=["Tu utilises déjà des probabilités sans le savoir : « 70 % de chances de pluie » à la météo, tirer à pile ou face pour décider qui commence un jeu, ou espérer tirer l'as dans un jeu de cartes."]
n[0]["exemple"]={"titre":"Exemple : pile ou face","etapes":["Une pièce équilibrée a deux faces, « pile » et « face », qui ont la même chance de sortir.","Une issue favorable sur deux issues possibles : la probabilité de « pile » est 1/2.","On peut l'écrire 0,5 ou 50 %."]}
n[0]["aRetenir"]="Une probabilité est toujours un nombre compris entre 0 et 1 : 0 pour l'impossible, 1 pour le certain."
n[1]["paragraphes"]+=["Dans un jeu de 32 cartes, il y a 4 as : la probabilité de tirer un as est 4/32 = 1/8. Attention au piège : « deux issues possibles » ne veut pas dire « une chance sur deux ». Gagner ou perdre au loto, ce sont deux issues, mais elles sont loin d'avoir la même chance !"]
n[1]["aRetenir"]="La formule favorables ÷ total ne marche que si toutes les issues ont la même chance (équiprobabilité). Vérifie-le avant de calculer."
n[2]["exemple"]={"titre":"Exemple : au moins un 6 en deux lancers","etapes":["« Au moins un 6 » est long à compter. Son contraire est « aucun 6 sur les deux lancers ».","P(pas de 6 à un lancer) = 5/6, donc P(aucun 6 en deux lancers) = 5/6 × 5/6 = 25/36.","P(au moins un 6) = 1 − 25/36 = 11/36, soit environ 0,31."]}
n[2]["aRetenir"]="Quand tu vois « au moins un », pense au contraire : « aucun »."
n[3]["exemple"]={"titre":"Exemple : un sac, avec remise","etapes":["Un sac contient 2 boules rouges et 3 boules vertes. On tire une boule, on la regarde, on la remet, puis on en tire une seconde.","P(rouge) = 2/5 et P(verte) = 3/5, à chaque tirage (la boule est remise).","P(rouge puis verte) = 2/5 × 3/5 = 6/25 = 0,24."]}
n[4]["paragraphes"]+=["C'est ce qui permet aux casinos, aux assureurs et aux fabricants de jeux de prévoir leurs résultats sur de très nombreuses parties, sans pouvoir deviner une partie en particulier."]
n[4]["exemple"]={"titre":"Exemple : 600 lancers de dé","etapes":["On lance un dé 600 fois et on obtient 96 fois la face 6.","Fréquence observée : 96 ÷ 600 = 0,16.","Probabilité théorique : 1/6 ≈ 0,167. Les deux valeurs sont proches, comme le prévoit la loi des grands nombres."]}
n[4]["aRetenir"]="La fréquence varie d'une série à l'autre, mais elle se stabilise autour de la probabilité quand le nombre d'essais augmente. Elle ne permet pas de prédire le prochain résultat."
ex=d["application"]["exercices"]
ex+=[qcm("Une probabilité possible ?","Parmi ces nombres, lequel ne peut pas être une probabilité ?",["0,8","1,2","0"],1,"Une probabilité est toujours comprise entre 0 et 1. Le nombre 1,2 est supérieur à 1 : il ne peut donc pas être une probabilité.","Une probabilité est comprise entre 0 et 1."),
 nb("Somme de deux dés","On lance deux dés équilibrés. Quelle est la probabilité d'obtenir une somme égale à 10 ? (Écris une fraction, par exemple 3/36.)",1/12,["Il y a 36 issues équiprobables.","Sommes égales à 10 : 4+6, 5+5 et 6+4."],"3 issues favorables sur 36 : P = 3/36 = 1/12 ≈ 0,083.",tolerance=0.001),
 nb("Une urne avec trois couleurs","Une urne contient 5 boules rouges, 7 boules bleues et 8 boules vertes. Quelle est la probabilité de tirer une boule qui n'est pas rouge ?",0.75,["Il y a 5 + 7 + 8 = 20 boules.","P(non rouge) = 1 − P(rouge) = 1 − 5/20."],"P(rouge) = 5/20 = 0,25, donc P(non rouge) = 1 − 0,25 = 0,75."),
 nb("Prévoir sur beaucoup d'essais","On lance un dé équilibré 300 fois. Environ combien de fois obtiendra-t-on un 6 ?",50,["Sur un grand nombre d'essais, la fréquence se rapproche de la probabilité 1/6.","Calcule 300 × 1/6."],"300 × 1/6 = 50 fois environ (pas exactement : le hasard fait varier le résultat).",unite="fois")]
s=d["situation"]
s["histoire"]=["À la kermesse de l'école, une roue est partagée en **8 secteurs égaux** : 1 secteur « gros lot », 3 secteurs « petit lot » et 4 secteurs « perdu ».","Chaque tour coûte un ticket. Les enfants font la queue en rêvant du gros lot : une immense peluche ! Mais les organisateurs, eux, doivent prévoir assez de lots sans se ruiner.","Avant de tenter ta chance, calcule tes probabilités. La roue est parfaitement équilibrée, et chaque tour ne dépend pas des précédents."]
et=s["etapes"]
et.insert(2,nb("Perdre deux fois","Tu joues deux fois. Quelle est la probabilité de perdre les deux fois ?",0.25,["P(perdu) = 4/8 = 1/2.","Multiplie les probabilités : 1/2 × 1/2."],"1/2 × 1/2 = 1/4 = 0,25 : une chance sur quatre de repartir les mains vides deux fois de suite."))
s["conclusion"]="Bravo ! Tu as calculé des probabilités simples, utilisé l'événement contraire, multiplié des probabilités pour deux épreuves et prévu un résultat sur de nombreuses parties. Les organisateurs de jeux, les assureurs et les météorologues utilisent exactement ces calculs pour prévoir l'avenir… en moyenne. Souviens-toi : la roue n'a pas de mémoire, mais sur 400 tours, le hasard se laisse prévoir !"
assert len(ex)==10 and len(et)==5
save("probabilites",d)
