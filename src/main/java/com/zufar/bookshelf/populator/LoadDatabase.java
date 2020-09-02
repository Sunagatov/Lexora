package com.zufar.bookshelf.populator;

import com.zufar.bookshelf.entity.*;
import com.zufar.bookshelf.repository.RoleRepository;
import com.zufar.bookshelf.repository.UserRepository;
import com.zufar.bookshelf.service.AuthorService;
import com.zufar.bookshelf.service.BookService;
import com.zufar.bookshelf.service.CountryService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;

@Slf4j
@Configuration
class LoadDatabase {

    @Bean
    CommandLineRunner initDatabase(AuthorService authorService,
                                   BookService bookService,
                                   CountryService countryService,
                                   RoleRepository roleRepository,
                                   UserRepository userRepository) {
        return args -> {
            Role role_admin = new Role(1L, "ROLE_ADMIN");
            roleRepository.save(new Role(1L, "ROLE_ADMIN"));
            roleRepository.save(new Role(2L, "ROLE_USER"));

            Country russian_federation = new Country("Russian Federation");

            User user = new User(1L, "Admin", "Admin", LocalDate.now(), russian_federation, Gender.MALE, "admin", "admin", new HashSet<>());
            user.addRole(role_admin);
            userRepository .save(user);

            countryService.save(russian_federation);
            countryService.save(new Country("British India"));
            countryService.save(new Country("USA"));
            Author orwel = authorService.save(
                    null,
                    "Eric Blair Arthur", "George Orwell",
                    1903, 6, 25, 1950, 1, 21,
                    russian_federation.getId(),
                    null,
                    "https://mtdata.ru/u19/photoA884/20446828934-0/original.jpg");
            Author bradbury = authorService.save(
                    null,
                    "Ray Bradbury", "Ray",
                    1903, 6, 25, 1950, 1, 21,
                    russian_federation.getId(),
                    null,
                    "https://cdn.fishki.net/upload/post/2019/06/07/3000736/84232741-custom-3e54d21f7e32261f9866964be484ce23dee6d17f-s800.jpg");
            Author coelho = authorService.save(
                    null,
                    "Coelho", "Coelho",
                    1903, 6, 25, 1950, 1, 21,
                    russian_federation.getId(),
                    null,
                    "https://24smi.org/public/media/resize/800x-/celebrity/2017/08/11/WfzUTQ8NvHbj_aizek-azimov.jpg");
            Author asimov = authorService.save(
                    null,
                    "Isaac Asimov", "Isaac",
                    1903, 6, 25, 1950, 1, 21,
                    russian_federation.getId(),
                    null,
                    "https://mtdata.ru/u19/photoA884/20446828934-0/original.jpg");

            List<Long> authorsIds = new ArrayList<>();
            authorsIds.add(orwel.getId());
            authorsIds.add(coelho.getId());
            authorsIds.add(bradbury.getId());
            authorsIds.add(asimov.getId());

            bookService.save(
                    null,
                    "Nineteen Eighty-Four",
                    authorsIds,
                    1934, 6, 8,
                    russian_federation.getId(),
                    456,
                    "https://ozon-st.cdn.ngenix.net/multimedia/books_covers/1011018318.jpg",
                    "https://avidreaders.ru/download/1984.html?f=pdf",
                    "https://avidreaders.ru/download/1984.html?f=epub",
                    "https://avidreaders.ru/download/1984.html?f=fb2"
            );

            bookService.save(
                    null,
                    "A Clergyman's Daughter",
                    authorsIds,
                    1934, 6, 8,
                    russian_federation.getId(),
                    456,
                    "https://kbimages1-a.akamaihd.net/af813f5a-5e9c-41b0-993f-9e4c93f78a50/1200/1200/False/the-clergyman-s-daughter-2.jpg",
                    "http://www.arvindguptatoys.com/arvindgupta/orwelldaughter.pdf",
                    "https://www.globalgreyebooks.com/content/books/ebooks/clergymans-daughter.epub",
                    "https://readli.net/getfile.php?id=493328&format=fb2"
            );

            bookService.save(
                    null,
                    "Veronika Decides to Die",
                    authorsIds,
                    1934, 6, 8,
                    russian_federation.getId(),
                    456,
                    "https://1.bp.blogspot.com/-KV6Bw0vxYAI/Vu6adPzd_vI/AAAAAAAAAtE/uo8-0C1ziMgtTEESJJd1r_fN1_fRPslyw/s1600/paulo_koelo_veronika_reshaet_umeret_audiokniga_mp3_96_kbps.jpg",
                    "https://www.google.ru/url?sa=t&rct=j&q=&esrc=s&source=web&cd=2&cad=rja&uact=8&ved=2ahUKEwiY2LbnlKvmAhXSl4sKHaOqCfsQFjABegQIBRAB&url=https%3A%2F%2Fwww.academia.edu%2F38132827%2FVeronika_decides_to_die_by_Paulo_Coelho.pdf&usg=AOvVaw1_wR1za4yPABCO4vJIaxA5",
                    "https://avidreaders.ru/download/veronika-decides-to-die.html?f=epub",
                    "https://avidreaders.ru/download/veronika-decides-to-die.html?f=fb2"
            );
        };
    }
}